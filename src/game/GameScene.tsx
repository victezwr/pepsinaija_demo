import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
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

/** Mounted inside the Canvas once the story hands over to the chase. */
export function GameScene(): null {
  const { scene, camera } = useThree();

  useEffect(() => {
    let alive = true;
    useGame.setState({ phase: 'loading' });
    loadGameAssets()
      .then((assets) => {
        if (!alive) return;
        world = new ChaseWorld(assets, scene, camera as THREE.PerspectiveCamera, getStory().tier === 'low');
        const params = new URLSearchParams(window.location.search);
        world.autopilot = params.has('debug') && params.has('autopilot');
        scene.add(world.group);
        world.startReveal();
      })
      .catch(() => setStory({ fallback: true }));
    return () => {
      alive = false;
      world?.dispose();
      world = null;
    };
  }, [scene, camera]);

  useFrame((_, dt) => world?.update(Math.min(dt, 1 / 20)));
  return null;
}
