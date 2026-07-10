import { createServer, type ServerResponse } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SceneStore } from '../model/patch-store';
import type { Scene } from '../model/schema';

export interface PreviewServer { url: string; close(): Promise<void> }
export interface PreviewServerOptions { port: number; stateDir: string; host?: string }

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
};

export async function startPreviewServer({ port, stateDir, host = '127.0.0.1' }: PreviewServerOptions): Promise<PreviewServer> {
  const scenePath = path.join(stateDir, 'scene.json');
  const initial = JSON.parse(await readFile(scenePath, 'utf8')) as Scene;
  const store = new SceneStore(initial);
  const clients = new Set<ServerResponse>();
  const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root: runtimeRoot, server: { middlewareMode: true }, appType: 'spa' });

  const broadcast = (scene: Scene) => {
    const data = `event: revision\ndata: ${JSON.stringify(scene)}\n\n`;
    clients.forEach(client => client.write(data));
  };

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const watcher: FSWatcher = watch(scenePath, () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      try {
        const candidate = JSON.parse(await readFile(scenePath, 'utf8')) as Scene;
        const current = store.current();
        if (JSON.stringify(candidate) === JSON.stringify(current)) return;
        broadcast(store.replace(candidate));
      } catch { /* wait for the next complete atomic update */ }
    }, 40);
  });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${host}`);
    if (request.method === 'GET' && url.pathname === '/api/scene') return json(response, 200, store.current());
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      response.write(`event: revision\ndata: ${JSON.stringify(store.current())}\n\n`);
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/render-failed') {
      let body = '';
      request.on('data', chunk => { if (body.length < 16_384) body += chunk; });
      request.on('end', async () => {
        try {
          const { revision } = JSON.parse(body) as { revision?: unknown };
          if (!Number.isInteger(revision)) return json(response, 400, { error: { code: 'INVALID_REQUEST', message: 'revision must be an integer' } });
          const restored = store.markRenderFailed(revision as number);
          await writeFile(scenePath, JSON.stringify(restored, null, 2));
          broadcast(restored);
          json(response, 200, { ok: true, revision: restored.metadata.revision });
        } catch (error) {
          json(response, 409, { error: { code: 'ROLLBACK_FAILED', message: error instanceof Error ? error.message : 'Rollback failed' } });
        }
      });
      return;
    }
    vite.middlewares(request, response, () => json(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Preview server has no TCP address');
  return {
    url: `http://${host}:${address.port}/`,
    async close() { clearTimeout(debounce); watcher.close(); clients.forEach(client => client.end()); await vite.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
