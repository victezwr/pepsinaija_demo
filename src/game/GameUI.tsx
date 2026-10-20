import { useCallback } from 'react';
import { track } from '../analytics/track';
import { useStore } from '../state/store';
import { ArrowIcon, CapIcon, XIcon } from '../ui/icons';
import { HASHTAG, SHARE_URL, STAGES, TITLE, X_HANDLE } from './gameConfig';
import { chooseRunner, gameRunAgain } from './GameScene';
import { gameDom, useGame, type Runner } from './gameStore';

const fmt = (n: number): string => n.toLocaleString('en-NG');

export function GameUI(): JSX.Element {
  const phase = useGame((s) => s.phase);
  const registerBubble = useCallback((el: HTMLDivElement | null) => {
    gameDom.bubble = el;
  }, []);
  return (
    <div className="game-ui">
      <div ref={registerBubble} className="bubble" aria-live="polite" />
      {phase === 'loading' && <p className="game-loading">Loading the streets…</p>}
      {phase === 'menu' && <Menu />}
      {(phase === 'starting' || phase === 'running') && <Hud />}
      {phase === 'caught' && <GameOver />}
    </div>
  );
}

function Menu(): JSX.Element {
  const runner = useGame((s) => s.runner);
  const best = useGame((s) => s.best);
  return (
    <>
      <h1 className="game-title">{TITLE}</h1>
      <div className="menu-bottom">
        <div className="runners runners--mini" role="group" aria-label="Choose your runner">
          {(['male', 'female'] as Runner[]).map((r) => (
            <button
              key={r}
              className={`runner${runner === r ? ' runner--on' : ''}`}
              onClick={() => chooseRunner(r)}
              aria-pressed={runner === r}
              aria-label={r === 'male' ? 'Male runner' : 'Female runner'}
            >
              <img src={`/game/thumb-${r}.webp`} alt="" />
            </button>
          ))}
        </div>
        <p className="tap-to-run">TAP TO POP &amp; RUN</p>
        <p className="menu-hint">
          <ArrowIcon dir="left" size={18} />
          <ArrowIcon dir="up" size={18} />
          <ArrowIcon dir="down" size={18} />
          <ArrowIcon dir="right" size={18} />
          <span>swipe to dodge · double-tap to pulse</span>
        </p>
        {best > 0 && <p className="menu-best">Best run: {fmt(best)} m</p>}
      </div>
    </>
  );
}

function Hud(): JSX.Element {
  const distance = useGame((s) => s.distance);
  const caps = useGame((s) => s.caps);
  const chill = useGame((s) => s.chill);
  const pulse = useGame((s) => s.pulse);
  const flash = useGame((s) => s.pulseFlash);
  const stage = useGame((s) => s.stage);
  const banner = useGame((s) => s.banner);
  const lite = useStore((s) => s.tier) === 'low';
  const active = pulse === 'activating' || pulse === 'surging' || pulse === 'ending';
  const ready = pulse === 'charged';
  // The meter beats faster as it fills (2.2 s → 0.5 s per beat)
  const rate = `${(2.2 - 1.7 * chill).toFixed(2)}s`;
  return (
    <>
      <div className="hud2">
        <div className="hud2__dist">
          <strong>{fmt(distance)}</strong> m
          <span className="hud2__meta">SPEED {stage + 1}/{STAGES.length}</span>
        </div>
        <div className="hud2__right">
          <div className="hud2__caps">
            <CapIcon size={22} /> <strong>{fmt(caps)}</strong>
          </div>
          <div
            className={`pulse-meter${ready ? ' pulse-meter--ready' : ''}${active ? ' pulse-meter--on' : ''}`}
            style={{ ['--beat' as string]: rate }}
            aria-label={ready ? 'Pulse ready: double-tap' : `Pulse meter ${Math.round(chill * 100)}%`}
          >
            <div className="pulse-meter__fill" style={{ width: `${Math.round((active ? 1 : chill) * 100)}%` }} />
            <span>{ready ? 'PULSE READY' : 'PULSE'}</span>
          </div>
          {ready && <span className="pulse-hint">double-tap</span>}
        </div>
      </div>
      {pulse === 'surging' && <p className="pulse-stay">STAY ON THE PULSE</p>}
      {flash > 0 && <div key={flash} className={`pulse-flash${lite ? ' pulse-flash--lite' : ''}`} aria-hidden="true" />}
      {banner && (
        <p key={banner} className={`game-banner${banner === 'RELEASE THE PULSE' ? ' game-banner--pulse' : ''}`}>
          {banner}
        </p>
      )}
    </>
  );
}

function GameOver(): JSX.Element {
  const distance = useGame((s) => s.distance);
  const caps = useGame((s) => s.caps);
  const best = useGame((s) => s.best);
  const share = (): void => {
    const text = `I dodged the agberos for ${fmt(distance)}m and grabbed ${fmt(caps)} yellow caps with the new yellow-cap Pepsi ${X_HANDLE}! Can you beat my score? ${HASHTAG}`;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`;
    track('game_share', { distance, caps });
    window.open(url, '_blank', 'noopener');
  };
  return (
    <section className="gameover" aria-label="Game over">
      <h2 className="gameover__title">AGBEROS DON COLLECT AM!</h2>
      <div className="gameover__stats">
        <div>
          <strong>{fmt(distance)}</strong>
          <span>metres</span>
        </div>
        <div>
          <strong className="capnum">
            {fmt(caps)} <CapIcon size={18} />
          </strong>
          <span>caps</span>
        </div>
        <div>
          <strong>{fmt(best)}</strong>
          <span>best</span>
        </div>
      </div>
      <div className="gameover__actions">
        <button className="btn btn--solid" onClick={gameRunAgain}>
          RUN AGAIN
        </button>
        <button className="btn btn--x" onClick={share}>
          <XIcon size={16} /> CHALLENGE FRIENDS
        </button>
      </div>
      <div className="gameover__brand">
        <img src="/logo.svg" alt="Pepsi" width={34} height={34} />
        <span>
          STAY ON THE <b>PULSE</b>
        </span>
      </div>
      <button className="linkbtn" onClick={() => window.location.reload()}>
        Watch the intro again
      </button>
    </section>
  );
}
