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
// Longest world step per frame. Test hook: ?debug&clockcap=N lets a headless browser (about
// 1 fps) keep pace with the song, so beat sync can be measured.
const query = new URLSearchParams(window.location.search);
const STEP_CAP = query.has('debug') && query.has('clockcap') ? Number(query.get('clockcap')) || 0.1 : 0.1;
/** Share of the gap to the song's clock closed per second (the world follows it, smoothly). */
const SYNC_PULL = 3;

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

/** Runner picked on WHO CATCHES IT? (applied to the street when it opens). */
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

export function gameDebugSpawn(kind: 'danfo' | 'keke' | 'okada' | 'barrier' | 'table' | 'banner', ahead: number): void {
  world?.debugSpawn(kind, ahead);
}

export function gameDebugStumble(): void {
  world?.debugStumble();
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
  const songClock = useRef<number | null>(null); // where the world thinks the song is (s)
  useFrame((_, dt) => {
    if (!active || !world) return;
    // The world moves by frame time, steered gently onto the song's clock so rows keep landing
    // on the beat. (Stepping by the audio clock directly stuttered on low-end Android, where it
    // ticks in coarse 20-40 ms chunks: some frames moved nothing, others twice as far.)
    const b = music.beat();
    let step = Math.min(dt, 1 / 20);
    if (b === null) songClock.current = null;
    else {
      const song = b * music.BEAT_S;
      if (songClock.current === null) songClock.current = song - dt; // lock on
      const err = song - (songClock.current + dt); // what frame time alone would leave over
      step = Math.min(STEP_CAP, Math.max(0, dt + err * Math.min(1, SYNC_PULL * dt)));
      songClock.current += step;
      // A long stall (tab hidden, a big hitch): don't sprint to catch up, re-lock (rows re-sync)
      if (Math.abs(song - songClock.current) > 1) songClock.current = song;
    }
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
      world.useLiteMaterials();
      music.setLite(true);
      track('quality_drop', { fps: Math.round(fps), where: 'chase' });
    }
  });
  return null;
}
