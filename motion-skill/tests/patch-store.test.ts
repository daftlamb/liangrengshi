import { describe, expect, it } from 'vitest';
import { createDefaultScene } from '../src/model/defaults';
import type { Scene } from '../src/model/schema';
import { SceneStore } from '../src/model/patch-store';
import { estimateSceneCost, validateScene } from '../src/model/validate';

function animatedScene(count = 10, behaviorType: 'wave' | 'spring' = 'wave'): Scene {
  return {
    ...createDefaultScene('Test', 42),
    elements: [{ id: 'box', type: 'rectangle', width: 10, height: 10, fill: '#fff' }],
    generators: [{ id: 'copies', type: 'linear', elementId: 'box', count }],
    behaviors: [{ id: 'move', type: behaviorType }],
    falloffs: [{ id: 'fade', type: 'linear' }],
    animation: [{ id: 'binding', elementId: 'box', behaviorId: 'move', falloffIds: ['fade'], channels: ['x'], role: 'primary' }],
  };
}

describe('validateScene', () => {
  it('returns schema errors for malformed runtime input without throwing', () => {
    expect(() => validateScene({ metadata: null } as unknown as Scene)).not.toThrow();
    const result = validateScene({ metadata: null } as unknown as Scene);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports dangling references and duplicate IDs', () => {
    const scene = animatedScene();
    scene.elements.push({ id: 'box', type: 'circle', radius: 2 });
    scene.animation[0]!.behaviorId = 'missing';
    const result = validateScene(scene);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/unique/i);
    expect(result.errors.join(' ')).toMatch(/behavior/i);
  });

  it('rejects group self-reference and duplicate child IDs', () => {
    const scene = animatedScene();
    scene.elements.push({ id: 'group', type: 'group', childIds: ['group', 'box', 'box'] });
    expect(validateScene(scene).errors.join(' ')).toMatch(/self|duplicate child/i);
  });

  it('rejects channels that do not apply to the element type', () => {
    const scene = animatedScene();
    scene.animation[0]!.channels = ['letterSpacing'];
    expect(validateScene(scene).errors.join(' ')).toMatch(/channel/i);
  });
});

describe('estimateSceneCost', () => {
  it('classifies simple bindings and caps them at 500 instances', () => {
    const report = estimateSceneCost(animatedScene(501));
    expect(report.classification).toBe('simple');
    expect(report.instanceCount).toBe(501);
    expect(report.suggestedCount).toBe(500);
  });

  it('classifies spring bindings as compound and caps them at 150 instances', () => {
    const report = estimateSceneCost(animatedScene(151, 'spring'));
    expect(report.classification).toBe('compound');
    expect(report.suggestedCount).toBe(150);
  });

  it('uses grid dimensions deterministically', () => {
    const scene = animatedScene();
    scene.generators = [{ id: 'copies', type: 'grid', elementId: 'box', columns: 20, rows: 30 }];
    expect(estimateSceneCost(scene).instanceCount).toBe(600);
    expect(estimateSceneCost(scene)).toEqual(estimateSceneCost(structuredClone(scene)));
  });

  it('counts generated targets plus every ungenerated drawable singleton, excluding groups and rendered path guides', () => {
    const scene = animatedScene(4);
    scene.elements.push(
      { id: 'loose', type: 'circle', radius: 2 },
      { id: 'guide', type: 'line', x2: 100, y2: 0 },
      { id: 'path-dot', type: 'circle', radius: 1 },
      { id: 'group', type: 'group', childIds: ['loose'] },
    );
    scene.generators.push({ id: 'path-copies', type: 'path', elementId: 'path-dot', pathElementId: 'guide', count: 3 });
    expect(estimateSceneCost(scene).instanceCount).toBe(4 + 3 + 2);
  });
});

describe('SceneStore', () => {
  it('increments revisions for accepted mutations and returns defensive snapshots', () => {
    const store = new SceneStore(animatedScene());
    const result = store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []);
    expect(result.metadata.revision).toBe(1);
    result.composition.duration = 99;
    expect(store.current().composition.duration).toBe(5);
  });

  it('rejects preservation violations atomically', () => {
    const store = new SceneStore(animatedScene());
    const before = store.current();
    expect(() => store.apply([{ op: 'replace', path: '/composition/background', value: '#000' }], ['palette'])).toThrow(/preserve/i);
    expect(store.current()).toEqual(before);
  });

  it.each(['linear', 'grid', 'radial', 'path', 'scatter'] as const)('preserve layout rejects %s generator placement changes', (type) => {
    const scene = animatedScene();
    scene.elements.push({ id: 'guide', type: 'line', x2: 10, y2: 0 });
    scene.generators = type === 'linear' ? [{ id:'g', type, elementId:'box', count:2, start:{x:0,y:0}, end:{x:10,y:0} }]
      : type === 'grid' ? [{ id:'g', type, elementId:'box', count:4, columns:2, rows:2, gapX:10, gapY:10 }]
      : type === 'radial' ? [{ id:'g', type, elementId:'box', count:2, center:{x:10,y:10}, radius:5 }]
      : type === 'path' ? [{ id:'g', type, elementId:'box', pathElementId:'guide', count:2, start:0, end:1 }]
      : [{ id:'g', type, elementId:'box', seed:1, count:2, bounds:{x:0,y:0,width:10,height:10} }];
    const store = new SceneStore(scene);
    expect(() => store.apply([{ op:'replace', path:'/generators/0/count', value:3 }], ['layout'])).toThrow(/preserve layout/i);
  });

  it('preserve layout protects hierarchy, transforms, path sources, and geometry but allows palette changes', () => {
    const scene = animatedScene();
    scene.elements.push({ id:'guide', type:'line', x2:10, y2:0 }, { id:'group', type:'group', x:2, childIds:['box'] });
    scene.generators = [{ id:'g', type:'path', elementId:'box', pathElementId:'guide', count:2 }];
    for (const operation of [
      { op:'replace', path:'/elements/2/childIds', value:[] }, { op:'replace', path:'/elements/2/x', value:3 },
      { op:'replace', path:'/elements/1/x2', value:20 }, { op:'replace', path:'/generators/0/pathElementId', value:'box' },
    ] as const) expect(() => new SceneStore(scene).apply([operation], ['layout'])).toThrow();
    expect(new SceneStore(scene).apply([{ op:'replace', path:'/elements/0/fill', value:'#f00' }], ['layout']).elements[0]).toMatchObject({ fill:'#f00' });
  });

  it('preserve timing protects behavior clocks, time falloffs, and binding order but allows amplitude changes', () => {
    const scene = animatedScene();
    scene.behaviors[0] = { id:'move', type:'wave', amplitude:1, frequency:2, phase:.5 };
    scene.falloffs[0] = { id:'fade', type:'time', start:0, end:1 };
    scene.animation.push({ id:'support', elementId:'box', behaviorId:'move', falloffIds:[], channels:['y'], role:'supporting' });
    for (const operation of [
      { op:'replace', path:'/behaviors/0/frequency', value:3 }, { op:'replace', path:'/behaviors/0/phase', value:1 },
      { op:'replace', path:'/falloffs/0/end', value:2 }, { op:'move', from:'/animation/1', path:'/animation/0' },
    ] as const) expect(() => new SceneStore(scene).apply([operation], ['timing'])).toThrow(/preserve timing/i);
    expect(new SceneStore(scene).apply([{ op:'replace', path:'/behaviors/0/amplitude', value:2 }], ['timing']).behaviors[0]).toMatchObject({ amplitude:2 });
  });

  it('rejects invalid patches without changing the active scene', () => {
    const store = new SceneStore(animatedScene());
    const before = store.current();
    expect(() => store.apply([{ op: 'replace', path: '/composition/duration', value: -1 }], [])).toThrow();
    expect(store.current()).toEqual(before);
  });

  it('undoes to an equal prior snapshot while creating a new revision', () => {
    const store = new SceneStore(animatedScene());
    const before = store.current();
    store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []);
    const undone = store.undo();
    expect({ ...undone, metadata: { ...undone.metadata, revision: before.metadata.revision } }).toEqual(before);
    expect(undone.metadata.revision).toBe(2);
  });

  it('replace validates and increments the revision', () => {
    const store = new SceneStore(animatedScene());
    const replacement = animatedScene(20);
    replacement.metadata.revision = 99;
    expect(store.replace(replacement).metadata.revision).toBe(1);
  });

  it('rolls back a failed render revision and never reactivates it', () => {
    const store = new SceneStore(animatedScene());
    const first = store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []);
    store.apply([{ op: 'replace', path: '/composition/duration', value: 6 }], []);
    const restored = store.markRenderFailed(2);
    expect(restored.composition.duration).toBe(first.composition.duration);
    expect(restored.metadata.revision).toBeGreaterThan(2);
    expect(store.undo().metadata.revision).toBeGreaterThan(2);
    expect(store.current().composition.duration).not.toBe(6);
  });

  it('rejects a nonexistent failed revision atomically', () => {
    const store = new SceneStore(animatedScene());
    const before = store.current();
    expect(() => store.markRenderFailed(999)).toThrow();
    expect(store.current()).toEqual(before);
    expect(store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []).metadata.revision).toBe(1);
  });

  it('rejects an old non-active revision atomically', () => {
    const store = new SceneStore(animatedScene());
    store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []);
    const before = store.current();
    expect(() => store.markRenderFailed(0)).toThrow();
    expect(store.current()).toEqual(before);
    expect(store.apply([{ op: 'replace', path: '/composition/duration', value: 6 }], []).metadata.revision).toBe(2);
  });

  it('rejects an active failed revision with no safe target atomically', () => {
    const initial = animatedScene();
    initial.metadata.revision = 1;
    const store = new SceneStore(initial);
    const before = store.current();
    expect(() => store.markRenderFailed(1)).toThrow(/safe revision/i);
    expect(store.current()).toEqual(before);
    expect(store.apply([{ op: 'replace', path: '/composition/duration', value: 5 }], []).metadata.revision).toBe(2);
  });
});
