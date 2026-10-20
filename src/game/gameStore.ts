import { create } from 'zustand';
import { readPref } from '../util/storage';

export type GamePhase = 'loading' | 'reveal' | 'menu' | 'starting' | 'running' | 'caught';
export type Runner = 'male' | 'female';

export interface GameState {
  phase: GamePhase;
  runner: Runner;
  caps: number;
  distance: number; // metres, whole
  best: number; // best distance
  stage: number;
  chill: number; // 0..1 Fizz meter
  boosting: boolean;
  /** Short-lived centre banner (SPEED UP!, FIZZ BOOST!). */
  banner: string | null;
}

export const useGame = create<GameState>()(() => ({
  phase: 'loading',
  runner: 'male',
  caps: 0,
  distance: 0,
  best: Number(readPref('bestDistance') ?? 0) || 0,
  stage: 0,
  chill: 0,
  boosting: false,
  banner: null,
}));

/** DOM nodes the game drives per frame without React re-renders. */
export const gameDom: { bubble: HTMLElement | null } = { bubble: null };
