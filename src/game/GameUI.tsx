import { useCallback } from 'react';
import { track } from '../analytics/track';
import { useStore } from '../state/store';
import { openBoard, useBoard } from '../leaderboard/board';
import { CapIcon, PlayIcon, TrophyIcon, XIcon } from '../ui/icons';
import { HASHTAG, SHARE_URL, STAGES, X_HANDLE } from './gameConfig';
import { gameRestart, gameResume, gameRunAgain } from './GameScene';
import { gameDom, useGame } from './gameStore';

const fmt = (n: number): string => n.toLocaleString('en-NG');

export function GameUI(): JSX.Element {
  const phase = useGame((s) => s.phase);
  const registerBubble = useCallback((el: HTMLDivElement | null) => {
    gameDom.bubble = el;
  }, []);
  const cinematic = useGame((s) => s.cinematic);
  const paused = useGame((s) => s.paused);
  return (
    <div className={`game-ui${paused ? ' game-ui--paused' : ''}`}>
      <div ref={registerBubble} className="bubble" aria-live="polite" />
      {phase === 'loading' && <p className="game-loading">Loading the streets…</p>}
      {(phase === 'starting' || phase === 'running') && !cinematic && <Hud />}
      {phase === 'caught' && <GameOver />}
      {paused && <PauseMenu />}
    </div>
  );
}

/** Paused: RESUME (3, 2, 1, then on), RESTART, the leaderboard. */
function PauseMenu(): JSX.Element {
  const count = useGame((s) => s.resumeCount);
  const resume = useCallback((el: HTMLButtonElement | null) => el?.focus({ preventScroll: true }), []);
  if (count > 0) {
    return (
      <div className="pause pause--count" aria-live="assertive">
        <p key={count} className="pause__count">
          {count}
        </p>
      </div>
    );
  }
  return (
    <div className="pause" role="dialog" aria-modal="true" aria-label="Paused">
      <h2 className="pause__title">PAUSED</h2>
      <button ref={resume} className="btn btn--solid pause__resume" onClick={gameResume}>
        <PlayIcon /> RESUME
      </button>
      <button className="btn btn--ghost" onClick={gameRestart}>
        RESTART RUN
      </button>
      <button className="linkbtn" onClick={openBoard}>
        <TrophyIcon size={15} /> Leaderboard
      </button>
    </div>
  );
}

function Hud(): JSX.Element {
  const distance = useGame((s) => s.distance);
  const caps = useGame((s) => s.caps);
  const chill = useGame((s) => s.chill);
  const bank = useGame((s) => s.bank);
  const cost = useGame((s) => s.pulseCost);
  const pulse = useGame((s) => s.pulse);
  const flash = useGame((s) => s.pulseFlash);
  const stage = useGame((s) => s.stage);
  const banner = useGame((s) => s.banner);
  const lite = useStore((s) => s.tier) === 'low';
  const active = pulse === 'activating' || pulse === 'pulsing' || pulse === 'ending';
  // Time left in the Pulse: the world sets this bar's scale every frame (no React updates)
  const registerTimer = useCallback((el: HTMLDivElement | null) => {
    gameDom.pulseTimer = el;
  }, []);
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
            aria-label={ready ? 'Pulse ready: double-tap' : `Pulse meter: ${fmt(bank)} of ${fmt(cost)} saved caps`}
          >
            <div className="pulse-meter__fill" style={{ width: `${Math.round((active ? 1 : chill) * 100)}%` }} />
            <span>{ready ? 'PULSE READY' : active ? 'PULSE' : `PULSE ${fmt(Math.min(bank, cost))}/${fmt(cost)}`}</span>
          </div>
          {ready && <span className="pulse-hint">double-tap</span>}
          {active && (
            <div className="pulse-timer" aria-hidden="true">
              <div ref={registerTimer} className="pulse-timer__bar" />
            </div>
          )}
        </div>
      </div>
      {pulse === 'pulsing' && <p className="pulse-stay">STAY ON THE PULSE</p>}
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
  const bank = useGame((s) => s.bank);
  const cost = useGame((s) => s.pulseCost);
  const me = useBoard((s) => s.board?.me ?? null);
  const total = useBoard((s) => s.board?.total ?? 0);
  const status = useBoard((s) => s.status);
  const problem = useBoard((s) => s.problem);
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
      <p className="gameover__rank">
        {problem ?? (me ? `Leaderboard: #${fmt(me.rank)} of ${fmt(total)} (best ${fmt(me.distance)} m)` : status === 'loading' ? 'Checking the leaderboard…' : '')}
      </p>
      <p className="gameover__bank">
        {bank >= cost ? (
          <>
            <b>PULSE READY</b> for your next run: double-tap to release it
          </>
        ) : (
          <>
            Saved for the Pulse: <b>{fmt(bank)}</b> / {fmt(cost)} caps
          </>
        )}
      </p>
      <div className="gameover__actions">
        <button className="btn btn--solid" onClick={gameRunAgain}>
          RUN AGAIN
        </button>
        <button className="btn btn--x" onClick={share}>
          <XIcon size={16} /> CHALLENGE FRIENDS
        </button>
      </div>
      <button className="btn btn--ghost gameover__board" onClick={openBoard}>
        <TrophyIcon size={16} /> LEADERBOARD
      </button>
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
