import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'src/cli/motion-scene.ts');
const servers: number[] = [];

function run(cwd: string, args: string[]) {
  const result = spawnSync(path.join(root, 'node_modules/.bin/vite-node'), [cli, ...args], { cwd, encoding: 'utf8' });
  return { ...result, json: JSON.parse((result.stdout || result.stderr).trim()) as Record<string, unknown> };
}

async function sandbox() { return mkdtemp(path.join(tmpdir(), 'motion-cli-')); }

afterEach(() => { for (const pid of servers.splice(0)) try { process.kill(pid); } catch { /* already stopped */ } });

describe('motion-scene CLI', () => {
  it('initializes the default state paths and reports status', async () => {
    const cwd = await sandbox();
    expect(run(cwd, ['init', '--name', 'Demo', '--seed', '7']).json).toMatchObject({ ok: true, revision: 0, warnings: [] });
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8')).metadata.name).toBe('Demo');
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/history.json'), 'utf8'))).toHaveLength(1);
    expect(run(cwd, ['status']).json).toMatchObject({ ok: true, revision: 0, valid: true });
  });

  it('replaces, patches with constraints, preserves invalid-patch state, and undoes', async () => {
    const cwd = await sandbox();
    run(cwd, ['init']);
    const replacement = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    replacement.composition.background = '#abcdef';
    await writeFile(path.join(cwd, 'replacement.json'), JSON.stringify(replacement));
    expect(run(cwd, ['replace', '--file', 'replacement.json']).json).toMatchObject({ ok: true, revision: 1 });

    await writeFile(path.join(cwd, 'patch.json'), JSON.stringify([{ op: 'replace', path: '/composition/duration', value: 8 }]));
    expect(run(cwd, ['patch', '--file', 'patch.json', '--preserve', 'palette']).json).toMatchObject({ ok: true, revision: 2 });
    const before = await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8');
    await writeFile(path.join(cwd, 'bad.json'), JSON.stringify([{ op: 'replace', path: '/composition/duration', value: -1 }]));
    const bad = run(cwd, ['patch', '--file', 'bad.json']);
    expect(bad.status).not.toBe(0);
    expect(bad.json).toMatchObject({ ok: false });
    expect(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8')).toBe(before);
    expect(run(cwd, ['undo']).json).toMatchObject({ ok: true, revision: 3 });
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8')).composition.background).toBe('#abcdef');
  });

  it('warns when a replacement exceeds the instance budget', async () => {
    const cwd = await sandbox();
    run(cwd, ['init']);
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    scene.elements = [{ id: 'box', type: 'rectangle', width: 10, height: 10 }];
    scene.generators = [{ id: 'many', type: 'linear', elementId: 'box', count: 501 }];
    await writeFile(path.join(cwd, 'large.json'), JSON.stringify(scene));
    expect((run(cwd, ['replace', '--file', 'large.json']).json.warnings as string[]).join(' ')).toMatch(/500|budget/i);
  });

  it('reuses a healthy preview server and the launcher is cwd independent', async () => {
    const cwd = await sandbox();
    const state = path.join(cwd, 'state');
    run(cwd, ['init', '--state-dir', state]);
    const launcher = path.join(root, 'skill/scripts/preview.sh');
    const first = spawnSync(launcher, ['--state-dir', state, '--port', '0'], { cwd, encoding: 'utf8' });
    expect(first.status).toBe(0);
    const one = JSON.parse(first.stdout);
    servers.push(one.pid);
    const second = run(cwd, ['serve', '--state-dir', state, '--port', '0']).json;
    expect(second).toMatchObject({ ok: true, reused: true, url: one.url, pid: one.pid });
  });
});
