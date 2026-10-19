import { inject } from '@vercel/analytics';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAnalyticsProvider } from './analytics/track';
import { App } from './App';
import { getState } from './state/store';
import { bottleScreenBox } from './story/director';
import './ui/styles.css';

inject();

// Test hook for the Playwright walkthrough (tools/smoke.mjs); only with ?debug.
if (new URLSearchParams(window.location.search).has('debug')) {
  Object.assign(window, { __dsm: { getState, bottleScreenBox } });
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
