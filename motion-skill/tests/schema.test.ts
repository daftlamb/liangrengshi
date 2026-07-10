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
  it('allows more than three behaviors when they are not all bound', () => {
    const behaviors = Array.from({ length: 4 }, (_, index) => ({ id: `b${index}`, type: 'wave', amplitude: 1, frequency: 1, phase: 0 }));
    expect(sceneSchema.safeParse({ ...minimalScene, behaviors }).success).toBe(true);
  });
  it('limits bindings to one primary and two supporting roles', () => {
    const behaviors = Array.from({ length: 4 }, (_, index) => ({ id: `b${index}`, type: 'wave' as const }));
    const binding = (index: number, role: 'primary' | 'supporting') => ({ id: `a${index}`, elementId: 'title', behaviorId: `b${index}`, falloffIds: [], channels: ['x'] as const, role });
    expect(sceneSchema.safeParse({ ...minimalScene, behaviors, animation: [binding(0, 'primary'), binding(1, 'supporting'), binding(2, 'supporting')] }).success).toBe(true);
    expect(sceneSchema.safeParse({ ...minimalScene, behaviors, animation: [binding(0, 'primary'), binding(1, 'primary')] }).success).toBe(false);
    expect(sceneSchema.safeParse({ ...minimalScene, behaviors, animation: [binding(0, 'supporting'), binding(1, 'supporting'), binding(2, 'supporting')] }).success).toBe(false);
  });
  it('rejects unseeded noise behavior', () => expect(sceneSchema.safeParse({ ...minimalScene, behaviors: [{ id: 'noise', type: 'noise' }] }).success).toBe(false));
  it('accepts selectable waveforms', () => expect(sceneSchema.parse({ ...minimalScene, behaviors: [{ id: 'wave', type: 'wave', waveform: 'triangle' }] }).behaviors[0]).toMatchObject({waveform:'triangle'}));
  it('accepts line text splitting and normalized falloff modifiers', () => {
    const elements = [{ ...minimalScene.elements[0], split: 'lines' }];
    const falloffs = [{ id: 'field', type: 'linear', easing: 'easeInOut', invert: true, clamp: [0.2, 0.8] }];
    expect(sceneSchema.safeParse({ ...minimalScene, elements, falloffs }).success).toBe(true);
  });
  it('rejects reversed falloff clamp bounds', () => {
    const falloffs = [{ id: 'field', type: 'linear', clamp: [0.8, 0.2] }];
    expect(sceneSchema.safeParse({ ...minimalScene, falloffs }).success).toBe(false);
  });

  it('accepts every discriminated union variant', () => {
    const elements = [
      minimalScene.elements[0], { id: 'circle', type: 'circle', radius: 2 }, { id: 'rectangle', type: 'rectangle', width: 2, height: 3 },
      { id: 'line', type: 'line', x2: 2, y2: 3 }, { id: 'polygon', type: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
      { id: 'star', type: 'star', points: 5, innerRadius: 1, outerRadius: 2 }, { id: 'group', type: 'group', childIds: ['title'] },
    ];
    const generators = [{ id: 'gl', type: 'linear' }, { id: 'gg', type: 'grid' }, { id: 'gr', type: 'radial' }, { id: 'gp', type: 'path', pathElementId: 'line' }, { id: 'gs', type: 'scatter', seed: 1 }];
    const behaviors = [{ id: 'wave', type: 'wave' }, { id: 'noise', type: 'noise', seed: 1 }, { id: 'spring', type: 'spring' }, { id: 'follow', type: 'follow', targetElementId: 'title' }, { id: 'look', type: 'lookAt', targetElementId: 'title' }, { id: 'attract', type: 'attract', targetElementId: 'title' }, { id: 'repel', type: 'repel', targetElementId: 'title' }];
    const falloffs = [{ id: 'fl', type: 'linear' }, { id: 'fr', type: 'radial' }, { id: 'fi', type: 'index' }, { id: 'fx', type: 'random', seed: 1 }, { id: 'ft', type: 'time' }];
    expect(sceneSchema.safeParse({ ...minimalScene, elements, generators, behaviors, falloffs }).success).toBe(true);
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
  it('rejects an empty name', () => expect(() => createDefaultScene('', 7)).toThrow());
});
