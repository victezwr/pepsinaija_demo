import { getState } from '../state/store';

type EventName = 'started' | 'shook' | 'launched' | 'peeled' | 'finished' | 'replayed' | 'quality_drop' | 'fallback';

interface UmamiWindow extends Window {
  umami?: { track: (name: string, data?: Record<string, string | number>) => void };
}

// Story events go to Umami when VITE_UMAMI_WEBSITE_ID is set (Vercel's free plan has no custom events).
// Never throws, never blocks.
export function track(name: EventName, data: Record<string, string | number> = {}): void {
  try {
    const payload = { tier: getState().tier, ...data };
    if (import.meta.env.DEV) console.debug('[track]', name, payload);
    (window as UmamiWindow).umami?.track(name, payload);
  } catch {
    /* analytics must never break the experience */
  }
}

export function loadAnalyticsProvider(): void {
  const id = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
  if (!id) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = id;
  document.head.appendChild(s);
}
