import type { Scene } from './schema';

export function createDefaultScene(name: string, seed: number): Scene {
  if (!Number.isInteger(seed)) throw new TypeError('seed must be an integer');
  return {
    metadata: { schemaVersion: 1, revision: 0, seed, name },
    composition: { width: 1080, height: 1080, background: '#111111', duration: 4, loop: true, style: 'geometric' },
    elements: [], generators: [], behaviors: [], falloffs: [], animation: [],
  };
}
