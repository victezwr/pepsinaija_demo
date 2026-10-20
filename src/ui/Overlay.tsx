import { useCallback, useEffect, useRef, useState } from 'react';
import { CREDIT_HANDLE } from '../config';
import { chooseRunner } from '../game/GameScene';
import { useGame, type Runner } from '../game/gameStore';
import { useStore } from '../state/store';
import * as director from '../story/director';
import { dom } from '../story/rig';
import { HalftoneRing } from './HalftoneRing';
import { PlayIcon, SpeakerIcon } from './icons';
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
      {step === 'intro' && <IntroCard />}
      <Ripple />
      <Caption />
      <p className="credit">Unofficial concept by {CREDIT_HANDLE}</p>
      <FpsCounter />
    </div>
  );
}

/** SAME TASTE. NEW LOOK. above the bottle, PLAY beneath it. */
function IntroCard(): JSX.Element {
  const runner = useGame((s) => s.runner);
  const best = useGame((s) => s.best);
  const pick = (r: Runner): JSX.Element => (
    <button
      className={`runner runner--intro${runner === r ? ' runner--on' : ''}`}
      onClick={() => chooseRunner(r)}
      aria-pressed={runner === r}
      aria-label={r === 'male' ? 'Male runner' : 'Female runner'}
    >
      <img src={`/game/thumb-${r}.webp`} alt="" />
    </button>
  );
  return (
    <>
      <h1 className="intro-title">
        <span>SAME TASTE.</span>
        <span className="intro-title__accent">NEW LOOK.</span>
      </h1>
      <div className="intro-play">
        <div className="intro-play__row" role="group" aria-label="Choose your runner, then play">
          {pick('male')}
          <button className="btn btn--play" onClick={director.play}>
            <PlayIcon /> PLAY
          </button>
          {pick('female')}
        </div>
        <p className="intro-play__sub">
          <SpeakerIcon size={14} /> best with sound{best > 0 ? ` · best run ${best.toLocaleString('en-NG')} m` : ''}
        </p>
      </div>
    </>
  );
}

/** The blue energy ripple out of the bottle (cinematic); the director keeps it on the bottle. */
function Ripple(): JSX.Element | null {
  const n = useStore((s) => s.ripple);
  const big = useStore((s) => s.rippleBig);
  const step = useStore((s) => s.step);
  const register = useCallback((el: HTMLDivElement | null) => {
    dom.ripple = el;
  }, []);
  if (!n || step === 'game') return null;
  return (
    <div ref={register} key={n} className={`cine-ripple${big ? ' cine-ripple--big' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

function TopBar(): JSX.Element {
  const cinematic = useGame((s) => s.cinematic);
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
        {cinematic && (
          <button className="btn btn--ghost" onClick={director.skipCinematic}>
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
    <h1 key={h.text} className={`headline${h.accent ? ' headline--accent' : ''}${h.size === 'md' ? ' headline--md' : ''}${h.size === 'cine' ? ' headline--cine' : ''}`} aria-live="polite">
      {h.text}
    </h1>
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
