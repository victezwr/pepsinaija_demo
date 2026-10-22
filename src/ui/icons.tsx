// Small inline SVG icons (no emoji anywhere in the UI).

interface IconProps {
  size?: number;
  className?: string;
}

/** The yellow Pepsi cap used as the chase's coin. */
export function CapIcon({ size = 20, className }: IconProps): JSX.Element {
  const teeth = Array.from({ length: 21 }, (_, i) => {
    const a = (i / 21) * Math.PI * 2;
    return `${(12 + Math.cos(a) * 11.2).toFixed(2)},${(12 + Math.sin(a) * 11.2).toFixed(2)}`;
  });
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={teeth.join(' ')} fill="#e0a800" />
      <circle cx="12" cy="12" r="9.6" fill="#ffc400" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#ffe27a" strokeWidth="1.4" />
      <ellipse cx="9.5" cy="9" rx="2.6" ry="1.5" fill="#fff6c8" opacity="0.8" transform="rotate(-30 9.5 9)" />
    </svg>
  );
}

export function ArrowIcon({ dir, size = 22 }: IconProps & { dir: 'left' | 'right' | 'up' | 'down' }): JSX.Element {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)" />
      <path d="M12 6l5.5 6h-3.5v6h-4v-6H6.5z" fill="#fff" transform={`rotate(${rot} 12 12)`} />
    </svg>
  );
}

export function SpeakerIcon({ muted = false, size = 18 }: IconProps & { muted?: boolean }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
      {muted ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      ) : (
        <>
          <path d="M15.5 9a4 4 0 0 1 0 6" />
          <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      )}
    </svg>
  );
}

export function XIcon({ size = 16 }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.2h1.7L7.4 4.73H5.58l11.09 14.47z" />
    </svg>
  );
}

export function PlayIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
    </svg>
  );
}

export function TrophyIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10v4a5 5 0 0 1-10 0z" fill="#ffc400" />
      <path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5a3.5 3.5 0 0 1-3.5 3.5" fill="none" stroke="#ffc400" strokeWidth="1.8" />
      <path d="M10.5 11.5h3v4h-3z" fill="#e0a800" />
      <path d="M7.5 20.5h9l-1-4h-7z" fill="#ffc400" />
    </svg>
  );
}

export function PauseIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" />
    </svg>
  );
}
