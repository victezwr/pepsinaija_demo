import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import * as music from '../audio/music';
import { unlock as unlockAudio } from '../audio/sfx';
import { track } from '../analytics/track';
import { getState as getStory, setState as setStory } from '../state/store';
import { loadGameAssets } from './assets';
import { useGame, type Runner } from './gameStore';
import { ChaseWorld, type GameInput } from './world';

let world: ChaseWorld | null = null;
// Longest world step per frame when the song is the clock. Test hook: ?debug&clockcap=N lets a
// headless browser (about 1 fps) keep pace with the song, so beat sync can be measured.
const query = new URLSearchParams(window.location.search);
const STEP_CAP = query.has('debug') && query.has('clockcap') ? Number(query.get('clockcap')) || 0.2 : 0.2;

export function gameInput(action: GameInput): void {
  world?.input(action);
}

let skipPending = false;

/** SKIP the opening cinematic: straight into the run (waits for the street if it is still loading). */
export function gameSkipCinematic(): void {
  unlockAudio();
  skipPending = true;
  if (world && useGame.getState().phase === 'reveal') {
    world.skipCinematic();
    skipPending = false;
  }
}

export function gameRunAgain(): void {
  unlockAudio();
  world?.runAgain();
}

/** Runner picked on the intro card (applied to the street when it opens). */
export function chooseRunner(r: Runner): void {
  useGame.setState({ runner: r });
  world?.chooseRunner(r);
}

export function gameDebugState(): Record<string, unknown> | null {
  return world ? world.debugState() : null;
}

export function gameDebugCatch(): void {
  world?.debugCatch();
}

export function gameDebugPulse(): Record<string, unknown> | null {
  return world ? world.debugPulse() : null;
}

export function gameDebugDistance(m: number): void {
  world?.debugSetDistance(m);
}

export function gameDebugInvulnerable(secs: number): void {
  world?.debugInvulnerable(secs);
}

export function gameDebugNearMiss(): void {
  world?.debugNearMiss();
}

export function gameDebugChill(): void {
  world?.debugFillChill();
}

function activate(w: ChaseWorld): void {
  w.activate();
  if (skipPending) {
    skipPending = false;
    w.skipCinematic();
  }
}

/**
 * Mounted while the bottle is still dodging: builds the chase invisibly and pre-compiles its
 * shaders, so when `active` flips (the bottle bolts) the street appears with no loading pause.
 */
export function GameScene({ active }: { active: boolean }): null {
  const { scene, camera, gl } = useThree();
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let alive = true;
    loadGameAssets()
      .then((assets) => {
        if (!alive) return;
        world = new ChaseWorld(assets, scene, camera as THREE.PerspectiveCamera, getStory().tier === 'low');
        world.autopilot = new URLSearchParams(window.location.search).has('autopilot');
        music.setLite(getStory().tier === 'low');
        scene.add(world.group);
        world.prewarm(gl);
        if (activeRef.current) activate(world);
      })
      .catch(() => setStory({ fallback: true }));
    return () => {
      alive = false;
      skipPending = false;
      world?.dispose();
      world = null;
    };
  }, [scene, camera, gl]);

  useEffect(() => {
    if (!active) return;
    if (world) activate(world);
    else useGame.setState({ phase: 'loading' }); // assets still downloading: activate when built
  }, [active]);

  // Mid-run quality guard: the chase is heavier than the story, so keep measuring. If the
  // frame rate sags below 40 fps for ~3 s while running, drop to LITE (lower resolution,
  // lighter music, fewer foam puffs) unless the visitor picked a tier themselves.
  const perf = useRef({ frames: 0, time: 0 });
  const lastBeat = useRef<number | null>(null);
  useFrame((_, dt) => {
    if (!active || !world) return;
    // The theme is the clock: with it playing, the world advances by song time, so rows keep
    // landing on the beat even when frames are slow. Without it, frame time (capped).
    const b = music.beat();
    let step = Math.min(dt, 1 / 20);
    if (b !== null && lastBeat.current !== null) step = Math.min(STEP_CAP, Math.max(0, (b - lastBeat.current) * music.BEAT_S));
    lastBeat.current = b;
    world.update(step);
    const story = getStory();
    if (useGame.getState().phase !== 'running' || story.tier !== 'high' || story.tierLocked) return;
    const p = perf.current;
    p.frames++;
    p.time += dt;
    if (p.time < 3) return;
    const fps = p.frames / p.time;
    p.frames = 0;
    p.time = 0;
    if (fps < 40) {
      setStory({ tier: 'low' });
      music.setLite(true);
      track('quality_drop', { fps: Math.round(fps), where: 'chase' });
    }
  });
  return null;
}
