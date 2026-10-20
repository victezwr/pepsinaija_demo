import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { unlock as unlockAudio } from '../audio/sfx';
import { getState as getStory, setState as setStory } from '../state/store';
import { loadGameAssets } from './assets';
import { useGame, type Runner } from './gameStore';
import { ChaseWorld, type GameInput } from './world';

let world: ChaseWorld | null = null;

export function gameInput(action: GameInput): void {
  world?.input(action);
}

/** TAP TO RUN on the motor-park menu. */
export function gameTapToRun(): void {
  unlockAudio();
  world?.tapToRun();
}

export function gameRunAgain(): void {
  unlockAudio();
  world?.runAgain();
}

export function chooseRunner(r: Runner): void {
  world?.chooseRunner(r);
}

export function gameDebugState(): Record<string, unknown> | null {
  return world ? world.debugState() : null;
}

export function gameDebugCatch(): void {
  world?.debugCatch();
}

export function gameDebugChill(): void {
  world?.debugFillChill();
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
        scene.add(world.group);
        world.prewarm(gl);
        if (activeRef.current) world.activate();
      })
      .catch(() => setStory({ fallback: true }));
    return () => {
      alive = false;
      world?.dispose();
      world = null;
    };
  }, [scene, camera, gl]);

  useEffect(() => {
    if (!active) return;
    if (world) world.activate();
    else useGame.setState({ phase: 'loading' }); // assets still downloading: activate when built
  }, [active]);

  useFrame((_, dt) => {
    if (active) world?.update(Math.min(dt, 1 / 20));
  });
  return null;
}
