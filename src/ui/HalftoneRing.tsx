import { useEffect, useRef } from 'react';

interface Props {
  /** Diameter in CSS px. */
  size: number;
  className?: string;
  register?: (el: HTMLDivElement | null) => void;
}

/** The blue halftone ring from the reference, drawn once on a 2D canvas. */
export function HalftoneRing({ size, className, register }: Props): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    register?.(wrap.current);
    return () => register?.(null);
  }, [register]);

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(size * dpr);
    g.scale(dpr, dpr);
    g.clearRect(0, 0, size, size);
    const cx = size / 2;
    const r1 = size / 2;
    const r0 = r1 * 0.5;
    const sp = Math.max(3.2, size * 0.0125);
    // Seeded so every visitor sees the same pattern.
    let seed = 7;
    const rand = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let rr = r1 * 0.32; rr < r1; rr += sp * 0.9) {
      const n = Math.floor((2 * Math.PI * rr) / sp);
      const band = rr < r0 ? (rr - r1 * 0.32) / (r0 - r1 * 0.32) : 1 - (rr - r0) / (r1 - r0);
      const dot = sp * 0.42 * (rr < r0 ? 0.35 + 0.5 * band : 0.45 + 0.55 * Math.pow(band, 0.6));
      for (let i = 0; i < n; i++) {
        if (rr > r0 && rand() > 0.35 + band * 0.75) continue; // fuzzy outer edge
        const a = (i / n) * Math.PI * 2 + rr * 0.03;
        g.globalAlpha = rr < r0 ? 0.25 + 0.4 * band : 0.55 + 0.45 * band;
        g.fillStyle = rr < r0 ? '#0b2fd0' : '#0a3cff';
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, dot, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, [size]);

  return (
    <div ref={wrap} className={className} style={{ width: size, height: size }} aria-hidden="true">
      <canvas ref={canvas} style={{ width: size, height: size, display: 'block' }} />
    </div>
  );
}
