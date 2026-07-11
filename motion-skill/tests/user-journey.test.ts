import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../src/evaluate/scene';
import type { Scene } from '../src/model/schema';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'src/cli/motion-scene.ts');
const runner = path.join(root, 'node_modules/.bin/vite-node');

function run(cwd: string, args: string[]) {
  const result = spawnSync(runner, [cli, ...args], { cwd, encoding: 'utf8' });
  const json = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
  return { ...result, json };
}

const evaluationTime = 2.75;
const frame = (scene: Scene) => evaluateScene(scene, { time: evaluationTime, delta: 1 / 60, pointer: { x: 480, y: 270, active: false } });
const withoutRevision = (scene: Scene) => ({ ...scene, metadata: { ...scene.metadata, revision: 0 } });
const active = async (stateDir: string) => JSON.parse(await readFile(path.join(stateDir, 'current.json'), 'utf8')) as Scene;
const writeJson = (filename: string, value: unknown) => writeFile(filename, `${JSON.stringify(value)}\n`);

describe('complete CLI user journey', () => {
  it('creates, constrains three refinements, undoes exactly, and recovers from an invalid patch', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'motion-journey-'));
    const stateDir = path.join(cwd, 'state');
    const source = JSON.parse(await readFile(path.join(root, 'examples/01-character-wave.json'), 'utf8')) as Scene;
    const replacement = path.join(cwd, 'character-wave.json');
    await writeJson(replacement, source);

    expect(run(cwd, ['init', '--name', 'Draft', '--seed', '1', '--state-dir', stateDir]).status).toBe(0);
    expect(run(cwd, ['replace', '--file', replacement, '--state-dir', stateDir]).json).toMatchObject({ ok: true, revision: 1 });
    const created = await active(stateDir);
    expect(created.metadata.name).toBe('Character Wave');
    expect(frame(created).length).toBeGreaterThan(0);

    const durationPatch = path.join(cwd, 'duration.json');
    await writeJson(durationPatch, [{ op: 'replace', path: '/composition/duration', value: 8 }]);
    expect(run(cwd, ['patch', '--file', durationPatch, '--preserve', 'layout', '--preserve', 'content', '--preserve', 'palette', '--preserve', 'motion', '--state-dir', stateDir]).status).toBe(0);
    const timed = await active(stateDir);
    expect(timed.composition.duration).toBe(8);
    expect({ ...withoutRevision(timed), composition: { ...timed.composition, duration: created.composition.duration } }).toEqual(withoutRevision(created));
    expect(frame(timed).length).toBeGreaterThan(0);

    const palettePatch = path.join(cwd, 'palette.json');
    await writeJson(palettePatch, [
      { op: 'replace', path: '/composition/background', value: '#172554' },
      { op: 'replace', path: '/elements/0/fill', value: '#fef08a' },
    ]);
    expect(run(cwd, ['patch', '--file', palettePatch, '--preserve', 'layout', '--preserve', 'content', '--preserve', 'timing', '--preserve', 'motion', '--state-dir', stateDir]).status).toBe(0);
    const recolored = await active(stateDir);
    expect(recolored.composition.background).toBe('#172554');
    expect(recolored.elements[0]).toMatchObject({ fill: '#fef08a' });
    const restoredPalette = structuredClone(recolored);
    restoredPalette.composition.background = timed.composition.background;
    if ('fill' in restoredPalette.elements[0] && 'fill' in timed.elements[0]) restoredPalette.elements[0].fill = timed.elements[0].fill;
    expect(withoutRevision(restoredPalette)).toEqual(withoutRevision(timed));
    expect(frame(recolored).length).toBeGreaterThan(0);

    const noisePatch = path.join(cwd, 'noise.json');
    await writeJson(noisePatch, [
      { op: 'add', path: '/behaviors/-', value: { id: 'timing-noise', type: 'noise', amplitude: 0.12, frequency: 0.5, seed: 4242 } },
      { op: 'add', path: '/animation/-', value: { id: 'noisy-rotation', elementId: 'letters', behaviorId: 'timing-noise', falloffIds: [], channels: ['rotation'], role: 'supporting' } },
    ]);
    expect(run(cwd, ['patch', '--file', noisePatch, '--preserve', 'layout', '--preserve', 'content', '--preserve', 'palette', '--state-dir', stateDir]).status).toBe(0);
    const noisy = await active(stateDir);
    expect(noisy.behaviors).toContainEqual(expect.objectContaining({ id: 'timing-noise', seed: 4242 }));
    const noisyFrame = frame(noisy);
    const recoloredFrame = frame(recolored);
    const changedInstances: string[] = [];
    expect(noisyFrame).toHaveLength(recoloredFrame.length);
    noisyFrame.forEach((instance, index) => {
      const baseline = recoloredFrame[index];
      expect(instance.instanceId).toBe(baseline.instanceId);
      if (instance.rotation !== baseline.rotation) changedInstances.push(instance.instanceId);
      expect({ ...instance, rotation: baseline.rotation }).toEqual(baseline);
    });
    expect(changedInstances.length).toBeGreaterThan(0);
    expect(changedInstances.every(instanceId => instanceId.startsWith('letters:'))).toBe(true);

    const reloaded = await active(stateDir);
    expect(frame(reloaded)).toEqual(noisyFrame);
    const alternateSeed = structuredClone(noisy);
    const alternateNoise = alternateSeed.behaviors.find(behavior => behavior.id === 'timing-noise');
    if (!alternateNoise || alternateNoise.type !== 'noise') throw new Error('missing journey noise behavior');
    alternateNoise.seed = 4243;
    expect(frame(alternateSeed)).not.toEqual(noisyFrame);

    const strippedNoise = structuredClone(noisy);
    strippedNoise.behaviors = strippedNoise.behaviors.filter(behavior => behavior.id !== 'timing-noise');
    strippedNoise.animation = strippedNoise.animation.filter(binding => binding.id !== 'noisy-rotation');
    expect(withoutRevision(strippedNoise)).toEqual(withoutRevision(recolored));

    expect(run(cwd, ['undo', '--state-dir', stateDir]).status).toBe(0);
    const undone = await active(stateDir);
    expect(withoutRevision(undone)).toEqual(withoutRevision(recolored));
    expect(frame(undone)).toEqual(frame(recolored));

    const beforeInvalid = await readFile(path.join(stateDir, 'current.json'), 'utf8');
    const beforeInvalidFrame = frame(undone);
    const invalidPatch = path.join(cwd, 'invalid.json');
    await writeJson(invalidPatch, [{ op: 'replace', path: '/composition/duration', value: -1 }]);
    const invalid = run(cwd, ['patch', '--file', invalidPatch, '--state-dir', stateDir]);
    expect(invalid.status).not.toBe(0);
    expect(invalid.json).toMatchObject({ ok: false });
    expect(await readFile(path.join(stateDir, 'current.json'), 'utf8')).toBe(beforeInvalid);
    expect(frame(await active(stateDir))).toEqual(beforeInvalidFrame);
    expect(run(cwd, ['status', '--state-dir', stateDir]).json).toMatchObject({ ok: true, valid: true, revision: undone.metadata.revision });
  }, 15_000);
});
