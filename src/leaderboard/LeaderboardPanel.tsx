import { useEffect, useRef } from 'react';
import { CloseIcon, TrophyIcon } from '../ui/icons';
import { closeBoard, useBoard, type Entry } from './board';

const fmt = (n: number): string => n.toLocaleString('en-NG');

function Row({ e }: { e: Entry }): JSX.Element {
  return (
    <li className={`lb__row${e.me ? ' lb__row--me' : ''}${e.rank <= 3 ? ` lb__row--top${e.rank}` : ''}`}>
      <span className="lb__rank">{e.rank}</span>
      <span className="lb__name">
        {e.name}
        {e.me && <em> (you)</em>}
      </span>
      <span className="lb__dist">{fmt(e.distance)} m</span>
    </li>
  );
}

/** The leaderboard: the top 50 longest runs, then "…" and your own place if you're further down. */
export function LeaderboardPanel(): JSX.Element | null {
  const open = useBoard((s) => s.open);
  const board = useBoard((s) => s.board);
  const status = useBoard((s) => s.status);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeBoard();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open]);
  if (!open) return null;
  const me = board?.me ?? null;
  const below = me && me.rank > board!.top.length;
  return (
    <div className="lb-backdrop" onClick={closeBoard}>
      <section className="lb" role="dialog" aria-modal="true" aria-label="Leaderboard" onClick={(e) => e.stopPropagation()}>
        <header className="lb__head">
          <h2>
            <TrophyIcon size={22} /> LEADERBOARD
          </h2>
          <button ref={closeRef} className="btn btn--ghost lb__close" onClick={closeBoard} aria-label="Close the leaderboard">
            <CloseIcon />
          </button>
        </header>
        <p className="lb__sub">Longest runs{board ? ` · ${fmt(board.total)} ${board.total === 1 ? 'runner' : 'runners'}` : ''}</p>
        {status === 'offline' && !board && <p className="lb__note">The leaderboard isn’t open yet. Your runs still count towards your best.</p>}
        {status === 'loading' && !board && <p className="lb__note">Loading…</p>}
        {board && board.top.length === 0 && <p className="lb__note">No runs yet. Be the first on the board!</p>}
        {board && board.top.length > 0 && (
          <ol className="lb__list">
            {board.top.map((e) => (
              <Row key={e.rank} e={e} />
            ))}
            {below && (
              <>
                <li className="lb__gap" aria-label="more runners">
                  …
                </li>
                <Row e={me} />
              </>
            )}
          </ol>
        )}
        {board && !me && board.top.length > 0 && <p className="lb__note">Finish a run to get your place on the board.</p>}
      </section>
    </div>
  );
}
