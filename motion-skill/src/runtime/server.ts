import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { open, readFile, rename, rm } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { SceneStore } from '../model/patch-store';
import type { Scene } from '../model/schema';

export interface PreviewServer { url: string; close(): Promise<void> }
export interface PreviewServerOptions { port: number; stateDir: string; host?: string; previewIdentity?: { identity: string; session: string; pid: number } }

const json = (response: ServerResponse, status: number, body: unknown) => {
  if (response.writableEnded) return;
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

const MAX_REPORT_BYTES = 16 * 1024;

async function atomicJson(filename: string, value: unknown) {
  const temporary = `${filename}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
    await handle.close(); handle = undefined;
    await rename(temporary, filename);
    const directory = await open(path.dirname(filename), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

const readJsonBody = (request: IncomingMessage, response: ServerResponse): Promise<unknown> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  let bytes = 0;
  let settled = false;
  const finish = (operation: () => void) => { if (!settled) { settled = true; operation(); } };
  request.on('data', (chunk: Buffer) => {
    if (settled) return;
    bytes += chunk.length;
    if (bytes > MAX_REPORT_BYTES) {
      finish(() => { json(response, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 16 KiB' } }); resolve(undefined); });
      request.resume();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => finish(() => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { reject(new Error('Invalid JSON body')); }
  }));
  request.on('aborted', () => finish(() => reject(new Error('Request aborted'))));
  request.on('error', error => finish(() => reject(error)));
});

export async function startPreviewServer({ port, stateDir, host = '127.0.0.1', previewIdentity }: PreviewServerOptions): Promise<PreviewServer> {
  const scenePath = path.join(stateDir, 'state.json');
  const readCurrent = async () => (JSON.parse(await readFile(scenePath, 'utf8')) as { current: Scene }).current;
  const initial = await readCurrent();
  const store = new SceneStore(initial);
  const sessionToken = randomBytes(32).toString('base64url');
  const clients = new Set<ServerResponse>();
  const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root: runtimeRoot, server: { middlewareMode: true }, appType: 'spa' });

  const broadcast = (scene: Scene) => {
    const data = `event: revision\ndata: ${JSON.stringify(scene)}\n\n`;
    clients.forEach(client => client.write(data));
  };

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const watcher: FSWatcher = watch(stateDir, (_event, filename) => {
    if (filename !== 'state.json') return;
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        const candidate = await readCurrent();
        const current = store.current();
        if (JSON.stringify(candidate) === JSON.stringify(current)) return;
        broadcast(store.replace(candidate));
      } catch { /* wait for the next complete atomic update */ }
    }, 40);
  });

  let serverOrigin = '';
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${host}`);
    if (request.method === 'GET' && url.pathname === '/api/health' && previewIdentity) return json(response, 200, previewIdentity);
    if (request.method === 'GET' && url.pathname === '/api/scene') return json(response, 200, store.current());
    if (request.method === 'GET' && url.pathname === '/api/session') return json(response, 200, { token: sessionToken });
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      response.write(`event: revision\ndata: ${JSON.stringify(store.current())}\n\n`);
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/render-failed') {
      const suppliedToken = request.headers['x-preview-session'];
      const tokenValid = typeof suppliedToken === 'string' && suppliedToken.length === sessionToken.length
        && timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(sessionToken));
      if (request.headers.origin !== serverOrigin || !tokenValid) return json(response, 403, { error: { code: 'FORBIDDEN', message: 'Forbidden' } });
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers['content-type'] ?? '')) return json(response, 415, { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' } });
      try {
        const body = await readJsonBody(request, response);
        if (response.writableEnded) return;
        const { revision } = (body ?? {}) as { revision?: unknown };
        if (!Number.isInteger(revision)) return json(response, 400, { error: { code: 'INVALID_REQUEST', message: 'revision must be an integer' } });
        const restored = store.markRenderFailed(revision as number);
        const state = JSON.parse(await readFile(scenePath, 'utf8')) as { current: Scene; history: Scene[] };
        state.current = restored;
        state.history = [...state.history, restored].slice(-50);
        await atomicJson(scenePath, state);
        broadcast(restored);
        return json(response, 200, { ok: true, scene: restored });
      } catch (error) {
        return json(response, error instanceof SyntaxError || (error instanceof Error && error.message === 'Invalid JSON body') ? 400 : 409, { error: { code: 'ROLLBACK_FAILED', message: error instanceof Error ? error.message : 'Rollback failed' } });
      }
    }
    vite.middlewares(request, response, () => json(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Preview server has no TCP address');
  serverOrigin = `http://${host}:${address.port}`;
  return {
    url: `${serverOrigin}/`,
    async close() { clearTimeout(debounce); watcher.close(); clients.forEach(client => client.end()); await vite.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
