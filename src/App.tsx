import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { track } from './analytics/track';
import { CAMERA_FOV } from './config';
import { GameScene, gameInput, gameTapToRun } from './game/GameScene';
import { useGame } from './game/gameStore';
import { GameUI } from './game/GameUI';
import type { GameInput } from './game/world';
import { Experience } from './scene/Experience';
import { unlock as unlockAudio } from './audio/sfx';
import { getState, setState, useStore } from './state/store';
import * as director from './story/director';
import { EndCard } from './ui/EndCard';
import { Overlay, StageRing } from './ui/Overlay';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

function goFallback(reason: string): void {
  if (getState().fallback) return;
  setState({ fallback: true });
  track('fallback', { reason });
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(): void {
    goFallback('load');
  }
  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function App(): JSX.Element {
  const fallback = useStore((s) => s.fallback);
  const tier = useStore((s) => s.tier);
  const directorMode = useStore((s) => s.director);
  const step = useStore((s) => s.step);
  const lastMove = useRef(0);
  const swipe = useRef<{ x: number; y: number; done: boolean } | null>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  useEffect(() => {
    if (!hasWebGL()) goFallback('webgl');
  }, []);

  // Android: physical shaking also counts. iOS needs a permission prompt, which we never show.
  useEffect(() => {
    const needsPermission = typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
    if (needsPermission) return;
    const onMotion = (e: DeviceMotionEvent): void => {
      const a = e.acceleration;
      if (a && a.x !== null && a.y !== null && a.z !== null) {
        director.motion(Math.hypot(a.x, a.y, a.z));
      } else if (e.accelerationIncludingGravity?.x != null) {
        const g = e.accelerationIncludingGravity;
        director.motion(Math.abs(Math.hypot(g.x ?? 0, g.y ?? 0, g.z ?? 0) - 9.81));
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, []);

  useEffect(() => {
    const isButton = (t: EventTarget | null): boolean => t instanceof HTMLElement && t.closest('button') !== null;
    const keys: Record<string, GameInput> = {
      ArrowLeft: 'left',
      a: 'left',
      ArrowRight: 'right',
      d: 'right',
      ArrowUp: 'up',
      w: 'up',
      ' ': 'up',
      ArrowDown: 'down',
      s: 'down',
      b: 'boost',
    };
    const down = (e: KeyboardEvent): void => {
      if (getState().step === 'game') {
        if (useGame.getState().phase === 'menu' && (e.key === 'Enter' || e.key === ' ') && !isButton(e.target)) {
          e.preventDefault();
          gameTapToRun();
          return;
        }
        const action = keys[e.key];
        if (action && !isButton(e.target)) {
          e.preventDefault();
          gameInput(action);
        }
        return;
      }
      if (isButton(e.target) || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      if (getState().step === 'silhouette') director.wake();
      else director.keyShake(true);
    };
    const up = (e: KeyboardEvent): void => {
      if (e.key === ' ' || e.key === 'Enter') director.keyShake(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  if (fallback) {
    return (
      <main className="app app--fallback">
        <img className="poster" src="/poster.webp" alt="A cold Pepsi bottle with a yellow cap" />
        <EndCard note="Your browser can't run the 3D version, so here's the ending." />
      </main>
    );
  }

  const dpr: number | [number, number] = directorMode ? [2, 2] : tier === 'high' ? [1, 2] : 1.2;

  return (
    <main className="app">
      {step !== 'game' && <StageRing />}
      <div
        className="stage"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          // Android can suspend page audio (app switch, screen dim); every tap wakes it again.
          if (getState().step !== 'silhouette' && getState().step !== 'loading') unlockAudio();
          lastMove.current = e.timeStamp;
          if (step === 'game') {
            swipe.current = { x: e.clientX, y: e.clientY, done: false };
            if (useGame.getState().phase === 'menu') {
              gameTapToRun();
              return;
            }
          } else director.pointerDown(e.clientX, e.clientY, e.pointerType);
        }}
        onPointerMove={(e) => {
          if (step === 'game') {
            // One action per gesture, fired as soon as the finger has clearly moved.
            const sw = swipe.current;
            if (!sw || sw.done) return;
            const dx = e.clientX - sw.x;
            const dy = e.clientY - sw.y;
            if (Math.hypot(dx, dy) < 26) return;
            sw.done = true;
            gameInput(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
            return;
          }
          const dt = Math.max(0.001, (e.timeStamp - lastMove.current) / 1000);
          lastMove.current = e.timeStamp;
          director.pointerMove(e.clientX, e.clientY, e.pointerType, e.buttons > 0, dt);
        }}
        onPointerUp={(e) => {
          // Double-tap (two quick taps that didn't become swipes, same spot) fires the Fizz Boost.
          const sw = swipe.current;
          if (step === 'game' && sw && !sw.done) {
            const lt = lastTap.current;
            if (e.timeStamp - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40) {
              gameInput('boost');
              lastTap.current = { t: 0, x: 0, y: 0 };
            } else lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
          }
          swipe.current = null;
          director.pointerUp();
        }}
        onPointerCancel={() => {
          swipe.current = null;
          director.pointerUp();
        }}
      >
        <Canvas
          dpr={dpr}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: directorMode }}
          camera={{ fov: CAMERA_FOV, near: 0.05, far: 50, position: [0, 0.6, 4] }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.domElement.addEventListener('webglcontextlost', () => goFallback('context_lost'));
          }}
        >
          <SceneBoundary>
            <Suspense fallback={null}>{step !== 'game' && <Experience />}</Suspense>
            {(step === 'rebel' || step === 'exit' || step === 'game') && <GameScene active={step === 'game'} />}
          </SceneBoundary>
        </Canvas>
      </div>
      <Overlay />
      {step === 'game' && <GameUI />}
      {step === 'game' && <div className="handoff-flash" aria-hidden="true" />}
    </main>
  );
}
