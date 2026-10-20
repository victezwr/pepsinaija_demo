import { inject } from '@vercel/analytics';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAnalyticsProvider } from './analytics/track';
import { App } from './App';
import { getState } from './state/store';
import { bottleScreenBox } from './story/director';
import { gameDebugCoins, gameDebugState, gameInput } from './game/GameScene';
import { useGame } from './game/gameStore';
import { audioGraph } from './audio/sfx';
import { shout } from './audio/voices';
import './ui/styles.css';

inject();

// Test hook for the Playwright walkthrough (tools/smoke.mjs); only with ?debug.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __dsm: { getState, bottleScreenBox, game: useGame.getState, gameInput, gameDebugCoins, gameDebugState, audioGraph, shout } });
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
