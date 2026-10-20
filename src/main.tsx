import { inject } from '@vercel/analytics';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAnalyticsProvider } from './analytics/track';
import { App } from './App';
import { getState } from './state/store';
import { debugSpin, play } from './story/director';
import { gameDebugCatch, gameDebugChill, gameDebugDistance, gameDebugInvulnerable, gameDebugNearMiss, gameDebugPulse, gameDebugState, gameInput } from './game/GameScene';
import { useGame } from './game/gameStore';
import { audioGraph } from './audio/sfx';
import { beat } from './audio/music';
import { shout } from './audio/voices';
import './ui/styles.css';

inject();

// Test hook for the Playwright walkthrough (tools/smoke.mjs); only with ?debug.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __dsm: { getState, play, debugSpin, beat, game: useGame.getState, gameInput, gameDebugChill, gameDebugCatch, gameDebugDistance, gameDebugInvulnerable, gameDebugNearMiss, gameDebugPulse, gameDebugState, audioGraph, shout } });
}
loadAnalyticsProvider();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
