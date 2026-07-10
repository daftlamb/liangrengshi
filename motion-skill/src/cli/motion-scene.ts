#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Operation } from 'fast-json-patch';
import { createDefaultScene } from '../model/defaults';
import { SceneStore, type PreserveConstraint } from '../model/patch-store';
import type { Scene } from '../model/schema';
import { estimateSceneCost, validateScene } from '../model/validate';
import { startPreviewServer } from '../runtime/server';

type Args = { command: string; options: Map<string, string[]> };
type ServerInfo = { pid: number; port: number; url: string };

function parse(argv: string[]): Args {
  const command = argv.shift() ?? '';
  const options = new Map<string, string[]>();
  while (argv.length) {
    const key = argv.shift()!;
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv.shift();
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    const name = key.slice(2);
    options.set(name, [...(options.get(name) ?? []), value]);
  }
  return { command, options };
}

const one = (args: Args, name: string, fallback?: string) => args.options.get(name)?.at(-1) ?? fallback;
const stateDirFor = (args: Args) => path.resolve(one(args, 'state-dir', '.motion-scene')!);
const readJson = async <T>(filename: string): Promise<T> => JSON.parse(await readFile(filename, 'utf8')) as T;
async function atomicJson(filename: string, value: unknown) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filename);
}

const warningsFor = (scene: Scene): string[] => {
  const cost = estimateSceneCost(scene);
  return cost.suggestedCount === undefined ? [] : [`Instance budget exceeded (${cost.instanceCount}); suggested maximum is ${cost.suggestedCount}`];
};

async function loadState(dir: string) {
  const current = await readJson<Scene>(path.join(dir, 'current.json'));
  const history = await readJson<Scene[]>(path.join(dir, 'history.json'));
  return { current, history };
}

async function persist(dir: string, scene: Scene, history: Scene[]) {
  await atomicJson(path.join(dir, 'current.json'), scene);
  await atomicJson(path.join(dir, 'history.json'), history);
}

async function healthy(info: ServerInfo): Promise<boolean> {
  try { return (await fetch(`${info.url}api/scene`, { signal: AbortSignal.timeout(500) })).ok; } catch { return false; }
}

async function serve(args: Args) {
  const dir = stateDirFor(args);
  const infoPath = path.join(dir, 'server.json');
  try {
    const existing = await readJson<ServerInfo>(infoPath);
    if (await healthy(existing)) return { ok: true, ...existing, reused: true };
  } catch { /* start a server */ }
  const executable = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/.bin/vite-node');
  const child = spawn(executable, [fileURLToPath(import.meta.url), '__serve-child', '--state-dir', dir, '--port', one(args, 'port', '0')!], {
    detached: true, stdio: 'ignore', cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  });
  child.unref();
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    try { const info = await readJson<ServerInfo>(infoPath); if (info.pid === child.pid && await healthy(info)) return { ok: true, ...info, reused: false }; } catch { /* retry */ }
  }
  throw new Error('Preview server did not become healthy');
}

async function main() {
  const args = parse(process.argv.slice(2));
  const dir = stateDirFor(args);
  const currentPath = path.join(dir, 'current.json');
  if (args.command === '__serve-child') {
    const server = await startPreviewServer({ port: Number(one(args, 'port', '0')), stateDir: dir });
    const port = Number(new URL(server.url).port);
    await atomicJson(path.join(dir, 'server.json'), { pid: process.pid, port, url: server.url });
    await new Promise<void>(() => undefined);
    return;
  }
  if (args.command === 'serve') return serve(args);
  if (args.command === 'init') {
    const scene = createDefaultScene(one(args, 'name', 'Untitled')!, Number(one(args, 'seed', '1')));
    await persist(dir, scene, [scene]);
    return { ok: true, revision: scene.metadata.revision, warnings: warningsFor(scene) };
  }
  if (args.command === 'validate') {
    const scene = await readJson<Scene>(path.resolve(one(args, 'file', currentPath)!));
    const result = validateScene(scene);
    if (!result.valid) throw new Error(result.errors.join('; '));
    return { ok: true, valid: true, revision: scene.metadata.revision, warnings: warningsFor(scene) };
  }
  if (args.command === 'status') {
    const scene = await readJson<Scene>(currentPath);
    const result = validateScene(scene);
    return { ok: true, valid: result.valid, revision: scene.metadata.revision, warnings: warningsFor(scene), errors: result.errors };
  }
  const { current, history } = await loadState(dir);
  const store = new SceneStore(current);
  let scene: Scene;
  if (args.command === 'replace') scene = store.replace(await readJson<Scene>(path.resolve(one(args, 'file')!)));
  else if (args.command === 'patch') scene = store.apply(await readJson<Operation[]>(path.resolve(one(args, 'file')!)), (args.options.get('preserve') ?? []) as PreserveConstraint[]);
  else if (args.command === 'undo') {
    if (history.length < 2) throw new Error('No revision to undo');
    scene = structuredClone(history.at(-2)!);
    scene.metadata.revision = current.metadata.revision + 1;
  } else throw new Error(`Unknown command: ${args.command}`);
  await persist(dir, scene, [...history, scene].slice(-50));
  return { ok: true, revision: scene.metadata.revision, warnings: warningsFor(scene) };
}

main().then(result => { if (result) process.stdout.write(`${JSON.stringify(result)}\n`); }).catch(error => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
});
