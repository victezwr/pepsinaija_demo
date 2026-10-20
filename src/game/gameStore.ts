import { create } from 'zustand';
import { readPref } from '../util/storage';

export type GamePhase = 'loading' | 'reveal' | 'menu' | 'starting' | 'running' | 'caught';
export type Runner = 'male' | 'female';
/** Pulse Mode ability states. */
export type PulseState = 'empty' | 'charged' | 'activating' | 'surging' | 'ending';

export interface GameState {
  phase: GamePhase;
  runner: Runner;
  caps: number;
  distance: number; // metres, whole
  best: number; // best distance
  stage: number;
  chill: number; // 0..1 Pulse meter
  pulse: PulseState;
  /** Increments on each activation (drives the one-shot flash). */
  pulseFlash: number;
  /** Short-lived centre banner (SPEED UP!, RELEASE THE PULSE). */
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
  pulse: 'empty',
  pulseFlash: 0,
  banner: null,
}));

/** DOM nodes the game drives per frame without React re-renders. */
export const gameDom: { bubble: HTMLElement | null } = { bubble: null };
