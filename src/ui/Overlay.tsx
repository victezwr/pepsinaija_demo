import { useCallback, useEffect, useRef, useState } from 'react';
import { CREDIT_HANDLE } from '../config';
import { useStore } from '../state/store';
import * as director from '../story/director';
import { dom } from '../story/rig';
import { EndCard } from './EndCard';
import { HalftoneRing } from './HalftoneRing';
import { SpeakerIcon } from './icons';
import { useViewport } from './useViewport';

export function StageRing(): JSX.Element {
  const { w, h } = useViewport();
  const register = useCallback((el: HTMLDivElement | null) => {
    dom.ring = el;
  }, []);
  return <HalftoneRing size={Math.round(Math.min(w * 1.15, h * 0.62, 760))} className="stage-ring" register={register} />;
}

export function Overlay(): JSX.Element {
  const step = useStore((s) => s.step);
  return (
    <div className="overlay">
      <TopBar />
      <Headline />
      {step === 'loading' && <div className="loading" aria-label="Loading" />}
      {step === 'silhouette' && (
        <div className="prompt">
          <p className="prompt__main">TAP TO WAKE IT</p>
          <p className="prompt__sub">
            <SpeakerIcon size={14} /> best with sound
          </p>
        </div>
      )}
      <Hint />
      <Caption />
      {step === 'end' && <EndCard onReplay={director.replay} />}
      <p className="credit">Unofficial concept by {CREDIT_HANDLE}</p>
      <FpsCounter />
    </div>
  );
}

function TopBar(): JSX.Element {
  const step = useStore((s) => s.step);
  const muted = useStore((s) => s.muted);
  const tier = useStore((s) => s.tier);
  return (
    <div className="topbar">
      <button
        className="btn btn--ghost"
        onClick={() => useStore.setState({ tier: tier === 'high' ? 'low' : 'high', tierLocked: true })}
        aria-label={tier === 'high' ? 'Switch to lite mode' : 'Switch to full quality'}
      >
        {tier === 'high' ? 'LITE' : 'HD'}
      </button>
      <div className="topbar__right">
        {step === 'intro' && (
          <button className="btn btn--ghost" onClick={director.skipIntro}>
            SKIP
          </button>
        )}
        <button className="btn btn--ghost" onClick={() => director.setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
          <SpeakerIcon muted={muted} />
        </button>
      </div>
    </div>
  );
}

function Headline(): JSX.Element | null {
  const h = useStore((s) => s.headline);
  if (!h) return null;
  return (
    <h1 key={h.text} className={`headline${h.accent ? ' headline--accent' : ''}${h.size === 'md' ? ' headline--md' : ''}`} aria-live="polite">
      {h.text}
    </h1>
  );
}

function Hint(): JSX.Element | null {
  const hint = useStore((s) => s.hint);
  const urgent = useStore((s) => s.hintUrgent);
  if (!hint) return null;
  return (
    <p key={hint} className={`hint${urgent ? ' hint--urgent' : ''}`}>
      {hint}
    </p>
  );
}

function Caption(): JSX.Element | null {
  const caption = useStore((s) => s.caption);
  const muted = useStore((s) => s.muted);
  const audioOk = useStore((s) => s.audioOk);
  if (!caption || (!muted && audioOk)) return null;
  return <p className="caption">{caption}</p>;
}

function FpsCounter(): JSX.Element | null {
  const show = useStore((s) => s.showFps);
  const tier = useStore((s) => s.tier);
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  useEffect(() => {
    if (!show) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number): void => {
      frames.current++;
      if (t - last >= 500) {
        setFps(Math.round((frames.current * 1000) / (t - last)));
        frames.current = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [show]);
  if (!show) return null;
  return (
    <p className="fps">
      {fps} fps · {tier}
    </p>
  );
}
