import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'src/cli/motion-scene.ts');
const servers: number[] = [];

function run(cwd: string, args: string[], env?: Record<string, string>) {
  const result = spawnSync(path.join(root, 'node_modules/.bin/vite-node'), [cli, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  return { ...result, json: JSON.parse(result.stdout.trim()) as Record<string, unknown> };
}

async function sandbox() { return mkdtemp(path.join(tmpdir(), 'motion-cli-')); }

afterEach(() => { for (const pid of servers.splice(0)) try { process.kill(pid); } catch { /* already stopped */ } });

describe('motion-scene CLI', () => {
  it('creates a modernist opinion card directly from one viewpoint', async () => {
    const cwd = await sandbox();
    const result = run(cwd, ['opinion', '--text', '真正的壁垒不是模型能力而是进入日常工作流', '--seed', '77']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, revision: 0, relation: 'contrast', emphasis: ['模型能力', '日常工作流'] });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.composition).toMatchObject({ width: 900, height: 1200, duration: 5 });
    expect(scene.elements.find((element: { id: string }) => element.id === 'statement').text).toContain('真正的壁垒');
  }, 15_000);

  it('creates a relationship diagram card from one viewpoint', async () => {
    const cwd = await sandbox();
    const result = run(cwd, ['diagram', '--text', '真正的壁垒不是模型能力而是进入日常工作流', '--seed', '8']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, revision: 0, relation: 'contrast' });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.metadata.name).toContain('观点图解卡');
  });

  it('creates a chart scene from CSV by automatically selecting an available chart type', async () => {
    const cwd = await sandbox();
    const csv = path.join(cwd, 'channels.csv');
    await writeFile(csv, '渠道,占比\n小红书,36\n抖音,28\n天猫,21\n线下,15');
    const result = run(cwd, ['csv', '--file', csv, '--seed', '41']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, revision: 0, chart: 'donut', renderedChart: 'donut' });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.metadata.name).toBe('CSV 动态饼状图');
    expect(scene.elements.some((element: { type: string }) => element.type === 'sector')).toBe(true);
  });

  it('honors an explicit CSV chart override for a many-row donut card', async () => {
    const cwd = await sandbox();
    const csv = path.join(cwd, 'beauty-sales.csv');
    await writeFile(csv, '品类,销量指数\n防晒,86\n粉底液,74\n散粉,62\n口红,58\n面霜,71\n精华,67\n洁面,49\n香水,43\n卸妆,55\n身体乳,38');
    const result = run(cwd, ['csv', '--file', csv, '--chart', 'donut', '--seed', '7']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, chart: 'bar', renderedChart: 'donut' });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.metadata.name).toBe('CSV 动态饼状图');
    expect(scene.elements.filter((element: { type: string }) => element.type === 'sector')).toHaveLength(10);
  });

  it('dry-runs a Live Photo export from the current scene without audio or filters', async () => {
    const cwd = await sandbox();
    run(cwd, ['opinion', '--text', '真正有洞察的观点不一定让人愉悦', '--seed', '11']);
    const out = path.join(cwd, 'output/live-photo');
    const result = run(cwd, ['export', '--format', 'live-photo', '--out', out, '--dry-run', 'true']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, format: 'live-photo', platform: 'xiaohongshu', duration: 5, audio: false, filters: false, dryRun: true });
    expect(result.json.assets).toMatchObject({
      jpg: path.join(out, 'key.jpg'),
      mov: path.join(out, 'motion.mov'),
      pvt: path.join(out, 'key.pvt'),
      zip: path.join(out, 'key.pvt.zip'),
      readme: path.join(out, 'README.txt'),
    });
  });

  it('creates a CSV chart and dry-runs Live Photo export in one command', async () => {
    const cwd = await sandbox();
    const csv = path.join(cwd, 'trend.csv');
    await writeFile(csv, '月份,销量\n1月,32\n2月,38\n3月,35\n4月,49');
    const out = path.join(cwd, 'output/trend-live');
    const result = run(cwd, ['csv', '--file', csv, '--export', 'live-photo', '--out', out, '--dry-run', 'true']);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, chart: 'line', renderedChart: 'line' });
    expect(result.json.export).toMatchObject({ format: 'live-photo', dryRun: true, audio: false, filters: false });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.metadata.name).toBe('CSV 动态折线图');
  });

  it('accepts optional art direction for a relationship diagram', async () => {
    const cwd = await sandbox();
    const result = run(cwd, [
      'diagram', '--text', '天气和肤质导致化妆品销量降低', '--seed', '8',
      '--palette', 'signal-red', '--motion', 'calm', '--typography', 'editorial-serif', '--composition', 'causal',
    ]);
    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({ ok: true, direction: { palette: 'signal-red', motion: 'calm', typography: 'editorial-serif', composition: 'causal' } });
    const scene = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    expect(scene.composition.background).toBe('#F3F1EA');
    expect(scene.elements.find((element: { id: string }) => element.id === 'node-b').fill).toBe('#E52521');
    expect(scene.elements.find((element: { id: string }) => element.id === 'title-0').fontFamily).toBe('Songti SC');
    expect(scene.behaviors.find((behavior: { id: string }) => behavior.id === 'node-pulse').amplitude).toBe(0.035);
  });

  it('supports global and command help without touching state or requiring files to exist', async () => {
    const cwd = await sandbox();
    const global = run(cwd, ['--help']);
    expect(global.status).toBe(0);
    expect(global.json).toMatchObject({ ok: true, help: true });

    const command = run(cwd, ['patch', '--file', 'missing.json', '--preserve', 'palette', '--help']);
    expect(command.status).toBe(0);
    expect(command.json).toMatchObject({ ok: true, help: true, command: 'patch' });
    await expect(access(path.join(cwd, '.motion-scene'))).rejects.toThrow();

    expect(run(cwd, ['patch', '--file', 'missing.txt', '--help']).status).not.toBe(0);
    expect(run(cwd, ['patch', '--file', 'missing.json', '--wat', 'x', '--help']).status).not.toBe(0);
    expect(run(cwd, ['patch', '--file', 'missing.json', '--file', 'other.json', '--help']).status).not.toBe(0);
  });
  it('initializes the default state paths and reports status', async () => {
    const cwd = await sandbox();
    expect(run(cwd, ['init', '--name', 'Demo', '--seed', '7']).json).toMatchObject({ ok: true, revision: 0, warnings: [] });
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8')).metadata.name).toBe('Demo');
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/history.json'), 'utf8'))).toHaveLength(1);
    expect(run(cwd, ['status']).json).toMatchObject({ ok: true, revision: 0, valid: true });
  }, 15_000);

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
  }, 15_000);

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

  it('rejects unknown, duplicate, missing, and invalid options with one stdout JSON value', async () => {
    const cwd = await sandbox();
    for (const args of [['init', '--wat', 'x'], ['init', '--name', 'a', '--name', 'b'], ['replace'], ['init', '--seed', 'nope']]) {
      const result = run(cwd, args);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(result.json).toMatchObject({ ok: false, code: 'INVALID_ARGUMENT' });
    }
  });

  it('commits despite projection failure, warns, and does not double apply on repair', async () => {
    const cwd = await sandbox();
    run(cwd, ['init']);
    const replacement = JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'));
    replacement.composition.background = '#123456';
    await writeFile(path.join(cwd, 'replacement.json'), JSON.stringify(replacement));
    const failed = run(cwd, ['replace', '--file', 'replacement.json'], { MOTION_TEST_FAIL_PROJECTION: 'history.json' });
    expect(failed.status).toBe(0);
    expect(failed.json).toMatchObject({ ok: true, revision: 1 });
    expect((failed.json.warnings as string[]).join(' ')).toMatch(/projection/i);
    expect(run(cwd, ['status']).json).toMatchObject({ ok: true, revision: 1 });
    const state = JSON.parse(await readFile(path.join(cwd, '.motion-scene/state.json'), 'utf8'));
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/current.json'), 'utf8'))).toEqual(state.current);
    expect(JSON.parse(await readFile(path.join(cwd, '.motion-scene/history.json'), 'utf8'))).toEqual(state.history);
  }, 15_000);

  it('never falls back to projections or rewrites a corrupt authority', async () => {
    const cwd = await sandbox();
    run(cwd, ['init']);
    const authority = path.join(cwd, '.motion-scene/state.json');
    await writeFile(authority, '{broken');
    const result = run(cwd, ['status']);
    expect(result.status).not.toBe(0);
    expect(result.json).toMatchObject({ ok: false, code: 'COMMAND_FAILED' });
    expect(await readFile(authority, 'utf8')).toBe('{broken');
  }, 15_000);

  it('rejects inconsistent legacy projections during first migration', async () => {
    const cwd = await sandbox();
    run(cwd, ['init']);
    const dir = path.join(cwd, '.motion-scene');
    await rm(path.join(dir, 'state.json'));
    const current = JSON.parse(await readFile(path.join(dir, 'current.json'), 'utf8'));
    current.metadata.name = 'inconsistent';
    await writeFile(path.join(dir, 'current.json'), JSON.stringify(current));
    const result = run(cwd, ['status']);
    expect(result.status).not.toBe(0);
    expect(result.json.message).toMatch(/inconsistent/i);
    await expect(readFile(path.join(dir, 'state.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not fetch an attacker-controlled metadata URL and replaces mismatched requested ports', async () => {
    const cwd = await sandbox();
    const state = path.join(cwd, 'state');
    run(cwd, ['init', '--state-dir', state]);
    await writeFile(path.join(state, 'server.json'), JSON.stringify({ pid: process.pid, port: 80, url: 'http://example.com/', identity: 'bad', session: 'bad' }));
    const first = run(cwd, ['serve', '--state-dir', state, '--port', '0']);
    expect(first.json).toMatchObject({ ok: true, reused: false });
    servers.push(first.json.pid as number);
    const requested = (first.json.port as number) === 43199 ? 43200 : 43199;
    const second = run(cwd, ['serve', '--state-dir', state, '--port', String(requested)]);
    expect(second.json).toMatchObject({ ok: true, reused: false, port: requested });
    servers.push(second.json.pid as number);
  });

  it('clears stale unowned PID metadata without signalling that PID and leaves no temporary files', async () => {
    const cwd = await sandbox();
    const state = path.join(cwd, 'state');
    run(cwd, ['init', '--state-dir', state]);
    await writeFile(path.join(state, 'server.json'), JSON.stringify({ pid: process.pid, port: 9, identity: 'wrong', session: 'wrong' }));
    const result = run(cwd, ['serve', '--state-dir', state]);
    expect(result.status).toBe(0);
    servers.push(result.json.pid as number);
    expect(await readdir(state)).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.tmp-/)]));
    await rm(path.join(state, 'server.json'));
  });
});
