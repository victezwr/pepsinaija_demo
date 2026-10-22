import { create } from 'zustand';
import { readPref } from '../util/storage';
import { pulseCostFor } from './gameConfig';

/** Caps saved across runs, and Pulses released so far (the next one costs more). */
export const savedBank = (): number => Math.max(0, Math.floor(Number(readPref('capBank') ?? 0) || 0));
export const savedPulses = (): number => Math.max(0, Math.floor(Number(readPref('pulsesUsed') ?? 0) || 0));

/** reveal = the motor-park half of the opening cinematic; starting = the swing behind the runner. */
export type GamePhase = 'loading' | 'reveal' | 'starting' | 'running' | 'caught';
export type Runner = 'male' | 'female';
/** Pulse Mode ability states. */
export type PulseState = 'empty' | 'charged' | 'activating' | 'pulsing' | 'ending';

export interface GameState {
  phase: GamePhase;
  runner: Runner;
  caps: number;
  distance: number; // metres, whole
  best: number; // best distance
  stage: number;
  chill: number; // 0..1 Pulse meter
  /** Caps saved across runs towards the Pulse. */
  bank: number;
  pulseCost: number; // saved caps the next Pulse needs (2,000, then 4,000, 6,000...)
  pulse: PulseState;
  /** Increments on each activation (drives the one-shot flash). */
  pulseFlash: number;
  /** The opening cinematic is playing (from PLAY until the run starts or SKIP). */
  cinematic: boolean;
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
  chill: Math.min(1, savedBank() / pulseCostFor(savedPulses())),
  bank: savedBank(),
  pulseCost: pulseCostFor(savedPulses()),
  pulse: 'empty',
  pulseFlash: 0,
  cinematic: false,
  banner: null,
}));

/** DOM nodes the game drives per frame without React re-renders. */
export const gameDom: { bubble: HTMLElement | null; pulseTimer: HTMLElement | null } = { bubble: null, pulseTimer: null };
