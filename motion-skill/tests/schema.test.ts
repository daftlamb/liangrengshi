import { describe, expect, it } from 'vitest';
import { createDefaultScene } from '../src/model/defaults';
import { sceneSchema } from '../src/model/schema';

const minimalScene = {
  metadata: { schemaVersion: 1, revision: 0, seed: 42, name: 'Wave' },
  composition: { width: 1080, height: 1080, background: '#111111', duration: 4, loop: true, style: 'kinetic-type' },
  elements: [{ id: 'title', type: 'text', text: 'HELLO', split: 'characters', fill: '#ffffff', opacity: 1 }],
  generators: [], behaviors: [], falloffs: [], animation: [],
} as const;

describe('sceneSchema', () => {
  it('accepts a valid minimal scene', () => expect(sceneSchema.safeParse(minimalScene).success).toBe(true));
  it('rejects unknown element types', () => expect(sceneSchema.safeParse({ ...minimalScene, elements: [{ id: 'x', type: 'video' }] }).success).toBe(false));
  it('rejects missing references', () => expect(sceneSchema.safeParse({ ...minimalScene, animation: [{ id: 'a', elementId: 'missing', behaviorId: 'also-missing', falloffIds: [], channels: ['x'], role: 'primary' }] }).success).toBe(false));
  it('rejects negative duration', () => expect(sceneSchema.safeParse({ ...minimalScene, composition: { ...minimalScene.composition, duration: -1 } }).success).toBe(false));
  it('rejects out-of-range opacity', () => expect(sceneSchema.safeParse({ ...minimalScene, elements: [{ ...minimalScene.elements[0], opacity: 1.1 }] }).success).toBe(false));
  it.each(['scatter', 'random'] as const)('rejects unseeded %s primitives', (type) => {
    const key = type === 'scatter' ? 'generators' : 'falloffs';
    expect(sceneSchema.safeParse({ ...minimalScene, [key]: [{ id: 'randomized', type }] }).success).toBe(false);
  });
  it('rejects more than three default behaviors', () => {
    const behaviors = Array.from({ length: 4 }, (_, index) => ({ id: `b${index}`, type: 'wave', amplitude: 1, frequency: 1, phase: 0 }));
    expect(sceneSchema.safeParse({ ...minimalScene, behaviors }).success).toBe(false);
  });
});

describe('createDefaultScene', () => {
  it('creates the empty canonical scene', () => {
    expect(createDefaultScene('Untitled', 7)).toEqual({
      metadata: { schemaVersion: 1, revision: 0, seed: 7, name: 'Untitled' },
      composition: { width: 1080, height: 1080, background: '#111111', duration: 4, loop: true, style: 'geometric' },
      elements: [], generators: [], behaviors: [], falloffs: [], animation: [],
    });
  });
});
