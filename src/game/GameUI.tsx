import { useCallback, useEffect } from 'react';
import { EndCard } from '../ui/EndCard';
import { COIN_TARGET, STAGES } from './gameConfig';
import { chooseRunner, gameStart } from './GameScene';
import { gameDom, useGame, type Runner } from './gameStore';

export function GameUI(): JSX.Element {
  const phase = useGame((s) => s.phase);
  const registerBubble = useCallback((el: HTMLDivElement | null) => {
    gameDom.bubble = el;
  }, []);
  return (
    <div className="game-ui">
      <div ref={registerBubble} className="bubble" aria-live="polite" />
      {phase === 'loading' && <p className="game-loading">Loading the streets…</p>}
      {phase === 'card' && <IntroCard />}
      {phase === 'select' && <SelectRunner />}
      {(phase === 'running' || phase === 'caught' || phase === 'won') && <Hud />}
      {phase === 'caught' && <CaughtCard />}
      {phase === 'end' && <WinEnd />}
    </div>
  );
}

function IntroCard(): JSX.Element {
  return (
    <div className="game-center">
    <section className="game-card" aria-label="How to play">
      <h2 className="game-card__title">THE CHASE</h2>
      <p className="game-card__line">Avoid all obstacles to get the new Pepsi.</p>
      <p className="game-card__line">
        Collect as many caps as possible. You need <strong>{COIN_TARGET} 🟡</strong> to buy it.
      </p>
      <ul className="controls" aria-label="Controls">
        <li><span>⬅️ ➡️</span>swipe to change lane</li>
        <li><span>⬆️</span>swipe up to jump</li>
        <li><span>⬇️</span>swipe down to duck</li>
      </ul>
      <p className="game-card__muted">On a computer: arrow keys or W A S D.</p>
      <button className="btn btn--solid" onClick={() => useGame.setState({ phase: 'select' })}>
        NEXT
      </button>
    </section>
    </div>
  );
}

function SelectRunner(): JSX.Element {
  const runner = useGame((s) => s.runner);
  const pick = (r: Runner): void => chooseRunner(r);
  useEffect(() => chooseRunner(useGame.getState().runner), []);
  return (
    <div className="game-center">
    <section className="game-card game-card--select" aria-label="Choose your runner">
      <h2 className="game-card__title">CHOOSE YOUR RUNNER</h2>
      <div className="runners">
        {(['male', 'female'] as const).map((r) => (
          <button
            key={r}
            className={`runner${runner === r ? ' runner--on' : ''}`}
            onClick={() => pick(r)}
            aria-pressed={runner === r}
            aria-label={r === 'male' ? 'Male runner' : 'Female runner'}
          >
            <img src={`/game/thumb-${r}.webp`} alt="" />
          </button>
        ))}
      </div>
      <button className="btn btn--solid" onClick={gameStart}>
        START
      </button>
    </section>
    </div>
  );
}

function Hud(): JSX.Element {
  const coins = useGame((s) => s.coins);
  const best = useGame((s) => s.best);
  const stage = useGame((s) => s.stage);
  const banner = useGame((s) => s.banner);
  const pct = Math.min(100, (coins / COIN_TARGET) * 100);
  return (
    <>
      <div className="hud">
        <div className="hud__coins">
          🟡 <strong>{coins}</strong> / {COIN_TARGET}
        </div>
        <div className="hud__bar" role="progressbar" aria-valuenow={coins} aria-valuemin={0} aria-valuemax={COIN_TARGET}>
          <div className="hud__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="hud__meta">
          SPEED {stage + 1}/{STAGES.length} · BEST {best}
        </div>
      </div>
      {banner && (
        <p key={banner} className="game-banner">
          {banner}
        </p>
      )}
    </>
  );
}

function CaughtCard(): JSX.Element {
  const coins = useGame((s) => s.coins);
  const best = useGame((s) => s.best);
  return (
    <div className="game-center">
    <section className="game-card game-card--caught" aria-label="Caught">
      <h2 className="game-card__title">AGBEROS DON COLLECT AM 😭</h2>
      <p className="game-card__line">
        You got <strong>{coins} 🟡</strong> · Best {best}
      </p>
      <p className="game-card__line game-card__muted">You need {COIN_TARGET} to buy the Pepsi.</p>
      <button className="btn btn--solid" onClick={gameStart}>
        RUN AM AGAIN
      </button>
    </section>
    </div>
  );
}

function WinEnd(): JSX.Element {
  const coins = useGame((s) => s.coins);
  return (
    <div className="game-end">
      <EndCard onReplay={gameStart} replayLabel="Play again" note={`You collected ${coins} 🟡 and got the new Pepsi.`} />
      <button className="btn btn--ghost game-end__intro" onClick={() => window.location.reload()}>
        Watch the intro again
      </button>
    </div>
  );
}
