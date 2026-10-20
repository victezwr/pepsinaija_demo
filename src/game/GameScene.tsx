import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { getState as getStory, setState as setStory } from '../state/store';
import { loadGameAssets } from './assets';
import { useGame } from './gameStore';
import { ChaseWorld, type GameInput } from './world';

let world: ChaseWorld | null = null;

export function gameInput(action: GameInput): void {
  world?.input(action);
}

export function gameStart(): void {
  world?.start();
}

export function gameDebugState(): Record<string, unknown> | null {
  return world ? world.debugState() : null;
}

export function gameDebugCoins(n: number): void {
  world?.debugCoins(n);
}

export function chooseRunner(r: 'male' | 'female'): void {
  world?.chooseRunner(r);
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
