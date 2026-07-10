#!/usr/bin/env node
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { Operation } from 'fast-json-patch';
import { createDefaultScene } from '../model/defaults';
import { SceneStore, type PreserveConstraint } from '../model/patch-store';
import type { Scene } from '../model/schema';
import { estimateSceneCost, validateScene } from '../model/validate';
import { startPreviewServer } from '../runtime/server';

type Args = { command: string; options: Map<string, string[]>; help: boolean };
type State = { current: Scene; history: Scene[] };
type ServerInfo = { pid: number; port: number; identity: string; session: string };
const schemas: Record<string, { required?: string[]; repeatable?: string[]; options: string[] }> = {
  init: { options: ['name', 'seed', 'state-dir'] }, validate: { options: ['file', 'state-dir'] },
  replace: { options: ['file', 'state-dir'], required: ['file'] }, patch: { options: ['file', 'preserve', 'state-dir'], required: ['file'], repeatable: ['preserve'] },
  undo: { options: ['state-dir'] }, status: { options: ['state-dir'] }, serve: { options: ['state-dir', 'port'] },
  '__serve-child': { options: ['state-dir', 'port', 'identity', 'session'], required: ['state-dir', 'port', 'identity', 'session'] },
};
class CliError extends Error { constructor(message: string, readonly code = 'INVALID_ARGUMENT') { super(message); } }

function parse(argv: string[]): Args {
  if (argv.length === 1 && argv[0] === '--help') return { command: '', options: new Map(), help: true };
  const command = argv.shift() ?? '';
  const schema = schemas[command];
  if (!schema) throw new CliError(`Unknown command: ${command}`);
  const options = new Map<string, string[]>();
  let help = false;
  while (argv.length) {
    const key = argv.shift()!;
    if (!key.startsWith('--') || key === '--') throw new CliError(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (name === 'help') {
      if (help) throw new CliError(`Duplicate option: ${key}`);
      help = true;
      continue;
    }
    if (!schema.options.includes(name)) throw new CliError(`Unknown option: ${key}`);
    const value = argv.shift();
    if (value === undefined || value.startsWith('--')) throw new CliError(`Missing value for ${key}`);
    if (options.has(name) && !schema.repeatable?.includes(name)) throw new CliError(`Duplicate option: ${key}`);
    options.set(name, [...(options.get(name) ?? []), value]);
  }
  if (!help) for (const name of schema.required ?? []) if (!options.has(name)) throw new CliError(`Missing required option: --${name}`);
  const file = options.get('file')?.[0];
  if (file && path.extname(file).toLowerCase() !== '.json') throw new CliError('--file must use the .json extension');
  for (const preserve of options.get('preserve') ?? []) if (!['layout', 'content', 'palette', 'timing', 'motion'].includes(preserve)) throw new CliError(`Invalid --preserve value: ${preserve}`);
  if (options.has('seed')) integer(options.get('seed')![0], '--seed', 0, 0xffffffff);
  if (options.has('port')) integer(options.get('port')![0], '--port', 0, 65535);
  return { command, options, help };
}

const one = (args: Args, name: string, fallback?: string) => args.options.get(name)?.[0] ?? fallback;
function integer(value: string, name: string, min: number, max: number) {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new CliError(`${name} must be an integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new CliError(`${name} must be between ${min} and ${max}`);
  return number;
}
const stateDirFor = (args: Args) => path.resolve(one(args, 'state-dir', '.motion-scene')!);
const readJson = async <T>(filename: string): Promise<T> => JSON.parse(await readFile(filename, 'utf8')) as T;

async function atomicJson(filename: string, value: unknown) {
  const directory = path.dirname(filename);
  await mkdir(directory, { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
    await handle.close(); handle = undefined;
    await rename(temporary, filename);
    const dir = await open(directory, 'r');
    try { await dir.sync(); } finally { await dir.close(); }
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

const warningsFor = (scene: Scene): string[] => {
  const cost = estimateSceneCost(scene);
  return cost.suggestedCount === undefined ? [] : [`Instance budget exceeded (${cost.instanceCount}); suggested maximum is ${cost.suggestedCount}`];
};
async function project(dir: string, state: State, allowTestFailure = false) {
  if (allowTestFailure && process.env.MOTION_TEST_FAIL_PROJECTION === 'current.json') throw new Error('Injected current projection failure');
  await atomicJson(path.join(dir, 'current.json'), state.current);
  if (allowTestFailure && process.env.MOTION_TEST_FAIL_PROJECTION === 'history.json') throw new Error('Injected history projection failure');
  await atomicJson(path.join(dir, 'history.json'), state.history);
}
async function loadState(dir: string): Promise<State> {
  const authoritative = path.join(dir, 'state.json');
  let state: State;
  try { state = await readJson<State>(authoritative); }
  catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
    state = { current: await readJson<Scene>(path.join(dir, 'current.json')), history: await readJson<Scene[]>(path.join(dir, 'history.json')) };
    if (!Array.isArray(state.history) || state.history.length === 0 || JSON.stringify(state.history.at(-1)) !== JSON.stringify(state.current)) throw new Error('Legacy current/history state is inconsistent');
    await atomicJson(authoritative, state);
  }
  await project(dir, state).catch(() => undefined);
  return state;
}
async function persist(dir: string, current: Scene, history: Scene[]) {
  const state = { current, history };
  await atomicJson(path.join(dir, 'state.json'), state);
  try { await project(dir, state, true); return [] as string[]; }
  catch (error) { return [`State committed, but compatibility projection repair failed: ${error instanceof Error ? error.message : String(error)}`]; }
}

function validInfo(value: unknown): value is ServerInfo {
  const x = value as Partial<ServerInfo>;
  return !!x && Number.isInteger(x.pid) && (x.pid ?? 0) > 0 && Number.isInteger(x.port) && (x.port ?? 0) >= 1 && (x.port ?? 0) <= 65535
    && typeof x.identity === 'string' && x.identity.length >= 16 && typeof x.session === 'string' && x.session.length >= 16;
}
async function healthy(info: ServerInfo): Promise<boolean> {
  if (!validInfo(info)) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${info.port}/api/health`, { signal: AbortSignal.timeout(500) });
    if (!response.ok) return false;
    const body = await response.json() as Record<string, unknown>;
    return body.identity === info.identity && body.session === info.session && body.pid === info.pid;
  } catch { return false; }
}
async function waitForExit(child: ChildProcess, timeout: number) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise<boolean>(resolve => {
    const timer = setTimeout(() => { child.off('exit', exited); resolve(false); }, timeout);
    const exited = () => { clearTimeout(timer); resolve(true); };
    child.once('exit', exited);
  });
}
async function terminateLaunched(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  if (await waitForExit(child, 500)) return;
  child.kill('SIGKILL');
  await waitForExit(child, 500);
}
async function serve(args: Args) {
  const dir = stateDirFor(args); const infoPath = path.join(dir, 'server.json');
  const requested = integer(one(args, 'port', '0')!, '--port', 0, 65535);
  await loadState(dir);
  try {
    const existing = await readJson<unknown>(infoPath);
    if (validInfo(existing) && await healthy(existing) && (requested === 0 || requested === existing.port)) return { ok: true, ...existing, url: `http://127.0.0.1:${existing.port}/`, reused: true };
  } catch { /* absent or malformed metadata */ }
  await rm(infoPath, { force: true });
  const identity = randomUUID(); const session = randomUUID();
  const executable = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/.bin/vite-node');
  const child = spawn(executable, [fileURLToPath(import.meta.url), '__serve-child', '--state-dir', dir, '--port', String(requested), '--identity', identity, '--session', session], { detached: true, stdio: 'ignore', cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') });
  child.unref();
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    try { const info = await readJson<unknown>(infoPath); if (validInfo(info) && info.pid === child.pid && info.identity === identity && await healthy(info)) return { ok: true, ...info, url: `http://127.0.0.1:${info.port}/`, reused: false }; } catch { /* retry */ }
  }
  await terminateLaunched(child);
  await rm(infoPath, { force: true });
  throw new Error('Preview server did not become healthy');
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) {
    const available = Object.keys(schemas).filter(command => !command.startsWith('__'));
    if (!args.command) return { ok: true, help: true, commands: available };
    const schema = schemas[args.command];
    return { ok: true, help: true, command: args.command, options: schema.options.map(name => `--${name}`), required: schema.required?.map(name => `--${name}`) ?? [], repeatable: schema.repeatable?.map(name => `--${name}`) ?? [] };
  }
  const dir = stateDirFor(args);
  if (args.command === '__serve-child') {
    const port = integer(one(args, 'port')!, '--port', 0, 65535); const identity = one(args, 'identity')!; const session = one(args, 'session')!;
    const server = await startPreviewServer({ port, stateDir: dir, previewIdentity: { identity, session, pid: process.pid } });
    const selected = Number(new URL(server.url).port);
    await atomicJson(path.join(dir, 'server.json'), { pid: process.pid, port: selected, identity, session });
    await new Promise<void>(() => undefined); return;
  }
  if (args.command === 'serve') return serve(args);
  if (args.command === 'init') {
    const seed = integer(one(args, 'seed', '1')!, '--seed', 0, 0xffffffff); const scene = createDefaultScene(one(args, 'name', 'Untitled')!, seed);
    const projectionWarnings = await persist(dir, scene, [scene]); return { ok: true, revision: scene.metadata.revision, warnings: [...warningsFor(scene), ...projectionWarnings] };
  }
  if (args.command === 'validate') {
    const scene = one(args, 'file') ? await readJson<Scene>(path.resolve(one(args, 'file')!)) : (await loadState(dir)).current; const result = validateScene(scene);
    if (!result.valid) throw new Error(result.errors.join('; ')); return { ok: true, valid: true, revision: scene.metadata.revision, warnings: warningsFor(scene) };
  }
  const state = await loadState(dir);
  if (args.command === 'status') { const result = validateScene(state.current); return { ok: true, valid: result.valid, revision: state.current.metadata.revision, warnings: warningsFor(state.current), errors: result.errors }; }
  const store = new SceneStore(state.current); let scene: Scene;
  if (args.command === 'replace') scene = store.replace(await readJson<Scene>(path.resolve(one(args, 'file')!)));
  else if (args.command === 'patch') scene = store.apply(await readJson<Operation[]>(path.resolve(one(args, 'file')!)), (args.options.get('preserve') ?? []) as PreserveConstraint[]);
  else { if (state.history.length < 2) throw new Error('No revision to undo'); scene = structuredClone(state.history.at(-2)!); scene.metadata.revision = state.current.metadata.revision + 1; }
  const projectionWarnings = await persist(dir, scene, [...state.history, scene].slice(-50)); return { ok: true, revision: scene.metadata.revision, warnings: [...warningsFor(scene), ...projectionWarnings] };
}

main().then(result => { if (result) process.stdout.write(`${JSON.stringify(result)}\n`); }).catch(error => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: error instanceof CliError ? error.code : 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) })}\n`); process.exitCode = 1;
});
