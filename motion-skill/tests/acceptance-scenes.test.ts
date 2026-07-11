import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateScene, type RenderInstance } from '../src/evaluate/scene';
import { sceneSchema, type Scene } from '../src/model/schema';
import { estimateSceneCost, validateScene } from '../src/model/validate';

const names = [
  '01-character-wave',
  '02-radial-breath',
  '03-pointer-repel-grid',
  '04-outward-type-ring',
  '05-organic-dot-field',
  '06-following-lines',
  '07-progressive-stars',
  '08-swiss-poster',
] as const;

const frame = (time: number) => ({ time, delta: 1 / 60, pointer: { x: 480, y: 270, active: true } });
const load = async (name: string): Promise<Scene> => sceneSchema.parse(JSON.parse(
  await readFile(path.join(import.meta.dirname, '..', 'examples', `${name}.json`), 'utf8'),
));
const numericChannels = (instance: RenderInstance): number[] => {
  const numbers: number[] = [instance.x, instance.y, instance.rotation, instance.scale, instance.opacity];
  for (const value of Object.values(instance)) if (typeof value === 'number') numbers.push(value);
  return numbers;
};

describe('canonical acceptance scenes', () => {
  it('provides eight valid, budgeted fixtures with distinct seeds and at most three bindings', async () => {
    const scenes = await Promise.all(names.map(load));
    expect(new Set(scenes.map(scene => scene.metadata.seed)).size).toBe(names.length);
    for (const scene of scenes) {
      expect(validateScene(scene)).toEqual({ valid: true, errors: [] });
      const cost = estimateSceneCost(scene);
      expect(cost.instanceCount).toBeLessThanOrEqual(cost.limit);
      expect(scene.animation.length).toBeLessThanOrEqual(3);
    }
  });

  it.each(names)('%s evaluates finite, deterministically, and closes loops', async name => {
    const scene = await load(name);
    for (const time of [0, scene.composition.duration / 4, scene.composition.duration / 2]) {
      const first = evaluateScene(scene, frame(time));
      expect(first).toEqual(evaluateScene(scene, frame(time)));
      expect(first.length).toBeGreaterThan(0);
      expect(first.flatMap(numericChannels).every(Number.isFinite)).toBe(true);
    }
    if (scene.composition.loop) {
      expect(evaluateScene(scene, frame(scene.composition.duration))).toEqual(evaluateScene(scene, frame(0)));
    }
  });
});
