// The leaderboard, from the game's side: who you are (a random id made on first visit, and the
// name you typed on WHO CATCHES IT?), a run token from the server when each run starts, your
// distance sent when you're caught, and the board (top 50 + your own rank) for the UI.
// The server is api/ (Vercel). If it isn't reachable the board just says so; the game is unaffected.
import { create } from 'zustand';
import { track } from '../analytics/track';
import { readPref, writePref } from '../util/storage';

export interface Entry {
  rank: number;
  name: string;
  distance: number;
  me: boolean;
}

export interface Board {
  top: Entry[];
  me: Entry | null;
  total: number;
}

export interface BoardState {
  /** Your display name ('' until you've typed one). */
  name: string;
  board: Board | null;
  status: 'idle' | 'loading' | 'ready' | 'offline';
  /** The leaderboard panel is open. */
  open: boolean;
  /** Your last run was refused (e.g. the name isn't allowed): say why on the game-over panel. */
  problem: string | null;
}

export const useBoard = create<BoardState>()(() => ({
  name: readPref('playerName') ?? '',
  board: null,
  status: 'idle',
  open: false,
  problem: null,
}));

/** Your random player id (made once, kept in this browser). */
export function playerId(): string {
  let id = readPref('playerId');
  if (!id || !/^[a-z0-9]{16,32}$/.test(id)) {
    const bytes = new Uint8Array(15);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-5);
    writePref('playerId', id);
  }
  return id;
}

/** A name as the board will show it: 2–16 letters, digits, spaces and . _ ' -; null if not. */
export function tidyName(raw: string): string | null {
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return /^[\p{L}\p{N} ._'-]{2,16}$/u.test(name) ? name : null;
}

export function setName(raw: string): void {
  const name = tidyName(raw);
  if (!name) return;
  writePref('playerName', name);
  useBoard.setState({ name, problem: null });
}

let runToken: string | null = null;

async function call(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return null;
  }
}

/** A run is starting: get its token (best effort; without one the run just isn't recorded). */
export function startRun(): void {
  runToken = null;
  void call('/api/run', { method: 'POST', body: JSON.stringify({ player: playerId() }) })
    .then((r) => (r?.ok ? r.json() : null))
    .then((d: { token?: string } | null) => {
      runToken = d?.token ?? null;
    })
    .catch(() => {});
}

/** Caught: send the run (your best counts on the board) and refresh the board. */
export async function submitRun(distance: number): Promise<void> {
  const token = runToken;
  runToken = null;
  const name = useBoard.getState().name;
  if (!token || !name) {
    await refresh();
    return;
  }
  useBoard.setState({ status: 'loading' });
  const r = await call('/api/leaderboard', { method: 'POST', body: JSON.stringify({ player: playerId(), name, distance, token }) });
  if (r?.ok) {
    useBoard.setState({ board: (await r.json()) as Board, status: 'ready', problem: null });
    return;
  }
  const err = r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : null;
  if (err === 'name') {
    // Not allowed on a public board: ask again on the next WHO CATCHES IT?
    writePref('playerName', '');
    useBoard.setState({ name: '', problem: 'That name isn’t allowed on the leaderboard. You’ll pick another before your next run.' });
  }
  await refresh();
}

/** Load the board (top 50 and your own rank). */
export async function refresh(): Promise<void> {
  if (useBoard.getState().status !== 'ready') useBoard.setState({ status: 'loading' });
  const r = await call(`/api/leaderboard?player=${playerId()}`);
  if (r?.ok) useBoard.setState({ board: (await r.json()) as Board, status: 'ready' });
  else useBoard.setState({ status: 'offline' });
}

export function openBoard(): void {
  useBoard.setState({ open: true });
  track('leaderboard_open');
  void refresh();
}

export function closeBoard(): void {
  useBoard.setState({ open: false });
}
