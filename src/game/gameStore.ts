import { create } from 'zustand';
import { readPref } from '../util/storage';

export type GamePhase = 'loading' | 'reveal' | 'card' | 'select' | 'running' | 'caught' | 'won' | 'end';
export type Runner = 'male' | 'female';

export interface GameState {
  phase: GamePhase;
  runner: Runner;
  coins: number;
  best: number;
  stage: number;
  unlocked: boolean;
  /** Short-lived centre banner (SPEED UP!, 1000!). */
  banner: string | null;
}

export const useGame = create<GameState>()(() => ({
  phase: 'loading',
  runner: 'male',
  coins: 0,
  best: Number(readPref('best') ?? 0) || 0,
  stage: 0,
  unlocked: false,
  banner: null,
}));

/** DOM nodes the game drives per frame without React re-renders. */
export const gameDom: { bubble: HTMLElement | null } = { bubble: null };
