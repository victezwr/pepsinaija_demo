import { create } from 'zustand';
import { readPref } from '../util/storage';

export type Step = 'loading' | 'intro' | 'cinematic' | 'game';

export type Tier = 'high' | 'low';

export interface Headline {
  text: string;
  accent?: boolean;
  size?: 'xl' | 'md' | 'cine';
}

export interface AppState {
  step: Step;
  tier: Tier;
  tierLocked: boolean;
  muted: boolean;
  audioOk: boolean;
  headline: Headline | null;
  caption: string | null;
  fallback: boolean;
  /** Blue energy ripple out of the bottle in the cinematic: bumps per ripple. */
  ripple: number;
  rippleBig: boolean;
  reducedMotion: boolean;
  showFps: boolean;
  director: boolean;
}

const params = new URLSearchParams(window.location.search);
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const forcedTier: Tier | null = params.has('director') ? 'high' : params.has('lite') ? 'low' : null;

export const useStore = create<AppState>()(() => ({
  step: 'loading',
  tier: forcedTier ?? 'high',
  tierLocked: forcedTier !== null,
  muted: readPref('muted') === '1',
  audioOk: true,
  headline: null,
  caption: null,
  fallback: false,
  ripple: 0,
  rippleBig: false,
  reducedMotion: reduced,
  showFps: params.has('fps'),
  director: params.has('director'),
}));

export const getState = useStore.getState;
export const setState = useStore.setState;
