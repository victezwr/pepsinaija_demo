import { useCallback, useEffect, useRef, useState } from 'react';
import { CREDIT_HANDLE } from '../config';
import { gamePause } from '../game/GameScene';
import { useGame, type Runner } from '../game/gameStore';
import { openBoard, setName, tidyName, useBoard } from '../leaderboard/board';
import { useStore } from '../state/store';
import * as director from '../story/director';
import { dom } from '../story/rig';
import { HalftoneRing } from './HalftoneRing';
import { PauseIcon, PlayIcon, SpeakerIcon, TrophyIcon } from './icons';
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
      {step === 'choose' && <ChooseCard />}
      <Ripple />
      <Caption />
      <p className="credit">Unofficial concept by {CREDIT_HANDLE}</p>
      <FpsCounter />
    </div>
  );
}

/** SAME TASTE. NEW LOOK. above the bottle, PLAY beneath it. Shaken: DON'T SHAKE ME. */
function IntroCard(): JSX.Element {
  const best = useGame((s) => s.best);
  const warn = useStore((s) => s.shakeWarn);
  return (
    <>
      {warn ? (
        <h1 className="intro-title intro-title--warn" aria-live="polite">
          <span>DON'T</span>
          <span className="intro-title__accent">SHAKE ME.</span>
        </h1>
      ) : (
        <h1 className="intro-title">
          <span>SAME TASTE.</span>
          <span className="intro-title__accent">NEW LOOK.</span>
        </h1>
      )}
      <div className="intro-play">
        <button className="btn btn--play" onClick={director.play}>
          <PlayIcon /> PLAY
        </button>
        <button className="linkbtn intro-play__board" onClick={openBoard}>
          <TrophyIcon size={15} /> Leaderboard
        </button>
        <p className="intro-play__sub">
          <SpeakerIcon size={14} /> best with sound{best > 0 ? ` · best run ${best.toLocaleString('en-NG')} m` : ''}
        </p>
      </div>
    </>
  );
}

/**
 * After the bottle has blown: your name (for the leaderboard, remembered next time), then pick
 * who catches it, which opens the motor park.
 */
function ChooseCard(): JSX.Element {
  const runner = useGame((s) => s.runner);
  const saved = useBoard((s) => s.name);
  const [name, setNameText] = useState(saved);
  const [warn, setWarn] = useState(false);
  const valid = tidyName(name) !== null;
  const input = useRef<HTMLInputElement>(null);
  // Focus the name if there isn't one yet, else your last runner (keyboard: Enter picks)
  const first = useCallback((el: HTMLButtonElement | null) => {
    if (el && tidyName(useBoard.getState().name)) el.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!tidyName(useBoard.getState().name)) input.current?.focus({ preventScroll: true });
  }, []);
  const go = (r: Runner): void => {
    if (!valid) {
      setWarn(true);
      input.current?.focus();
      return;
    }
    setName(name);
    director.choose(r);
  };
  const pick = (r: Runner): JSX.Element => (
    <button
      ref={r === runner ? first : undefined}
      className={`runner runner--choose${runner === r ? ' runner--on' : ''}${valid ? '' : ' runner--wait'}`}
      onClick={() => go(r)}
      aria-label={r === 'male' ? 'Male runner' : 'Female runner'}
    >
      <img src={`/game/thumb-${r}.webp`} alt="" />
    </button>
  );
  return (
    <div className="choose">
      <h1 className="choose__title">
        WHO CATCHES <span>IT?</span>
      </h1>
      <label className="choose__name">
        <span>Your name on the leaderboard</span>
        <input
          ref={input}
          value={name}
          onChange={(e) => {
            setNameText(e.target.value);
            setWarn(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          maxLength={16}
          placeholder="Type your name"
          autoComplete="nickname"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={warn && !valid}
        />
      </label>
      {warn && !valid && <p className="choose__warn">Type your name first: 2–16 letters or numbers.</p>}
      <div className="choose__row" role="group" aria-label="Choose your runner">
        {pick('male')}
        {pick('female')}
      </div>
      <p className="choose__sub">Tap a runner to start</p>
    </div>
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
  const step = useStore((s) => s.step);
  const cinematic = useGame((s) => s.cinematic) && step !== 'choose';
  const canPause = useGame((s) => s.phase === 'running' && !s.cinematic && !s.paused) && step === 'game';
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
        {canPause && (
          <button className="btn btn--ghost" onClick={gamePause} aria-label="Pause">
            <PauseIcon />
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
