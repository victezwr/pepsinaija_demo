import { BRAND_HANDLE, CREDIT_HANDLE } from '../config';
import { useViewport } from './useViewport';
import { HalftoneRing } from './HalftoneRing';

interface Props {
  onReplay?: () => void;
  replayLabel?: string;
  note?: string;
}

export function EndCard({ onReplay, replayLabel = 'Replay', note }: Props): JSX.Element {
  const { w, h } = useViewport();
  const ringSize = Math.round(Math.min(w * 0.92, h * 0.46, 520));
  return (
    <section className="endcard" aria-label="End card">
      <div className="endcard__mark" style={{ width: ringSize, height: ringSize }}>
        <HalftoneRing size={ringSize} className="endcard__ring" />
        <img className="endcard__logo" src="/logo.svg" alt="Pepsi" style={{ width: ringSize * 0.42 }} />
      </div>
      <h2 className="endcard__line">
        <span className="endcard__top">STAY ON THE</span>
        <span className="endcard__accent">PULSE</span>
      </h2>
      {note && <p className="endcard__note">{note}</p>}
      {onReplay && (
        <button className="btn btn--solid" onClick={onReplay}>
          {replayLabel}
        </button>
      )}
      <p className="endcard__credit">
        Unofficial concept by {CREDIT_HANDLE} for {BRAND_HANDLE} · Not affiliated with PepsiCo
      </p>
    </section>
  );
}
