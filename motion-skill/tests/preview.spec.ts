import { expect, test } from 'playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Scene } from '../src/model/schema';
import { startPreviewServer, type PreviewServer } from '../src/runtime/server';

const scene = (revision = 0, name = 'Persistent preview'): Scene => ({
  metadata: { schemaVersion: 1, revision, seed: 7, name },
  composition: { width: 320, height: 180, background: '#101218', duration: 2, loop: true, style: 'geometric' },
  elements: [{ id: 'box', type: 'rectangle', x: 80, y: 50, width: 64, height: 40, fill: '#ff5f57' }],
  generators: [], behaviors: [], falloffs: [], animation: [],
});

let stateDir: string;
let server: PreviewServer;

test.beforeAll(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'motion-preview-'));
  await writeFile(path.join(stateDir, 'scene.json'), JSON.stringify(scene()));
  server = await startPreviewServer({ port: 0, stateDir });
});

test.afterAll(async () => {
  await server.close();
  await rm(stateDir, { recursive: true, force: true });
});

test('keeps a minimal persistent preview connected and rolls back failed renders', async ({ page }) => {
  await page.goto(server.url);
  await expect(page.getByTestId('connection')).toHaveText('connected');
  await expect(page.getByRole('heading')).toHaveText('Persistent preview');
  await expect(page.getByTestId('revision')).toHaveText('Revision 0');

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('width', /[3-9]\d{2,}/);
  await expect(canvas).toHaveAttribute('height', /[1-9]\d{2,}/);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Safe area' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
  await expect(page.getByText(/timeline|layers|parameters|chat/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.locator('main')).toHaveClass(/show-grid/);
  await page.getByRole('button', { name: 'Safe area' }).click();
  await expect(page.locator('main')).toHaveClass(/show-safe-area/);
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('MAIN');
  await page.evaluate(() => document.exitFullscreen());

  const navigationCount = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await writeFile(path.join(stateDir, 'scene.json'), JSON.stringify(scene(1, 'Updated live')));
  await expect(page.getByTestId('revision')).toHaveText('Revision 1');
  await expect(page.getByRole('heading')).toHaveText('Updated live');
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(navigationCount);

  const responseStatus = await page.evaluate(async () => {
    const { token } = await (await fetch('/api/session')).json() as { token: string };
    return (await fetch('/api/render-failed', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-preview-session': token },
    body: JSON.stringify({ revision: 1, message: 'draw exploded' }),
  })).status;
  });
  expect(responseStatus).toBe(200);
  await expect(page.getByTestId('revision')).toHaveText('Revision 2');
  await expect(page.getByRole('heading')).toHaveText('Persistent preview');
});

test('protects rollback reports with origin, session token, JSON, and a hard body limit', async ({ page, request }) => {
  await page.goto(server.url);
  const token = await page.evaluate(async () => ((await fetch('/api/session')).json() as Promise<{ token: string }>).then(value => value.token));
  const endpoint = `${server.url}api/render-failed`;
  const headers = { origin: server.url.slice(0, -1), 'content-type': 'application/json', 'x-preview-session': token };

  expect((await request.post(endpoint, { data: { revision: 0 }, headers: { ...headers, 'x-preview-session': '' } })).status()).toBe(403);
  expect((await request.post(endpoint, { data: { revision: 0 }, headers: { ...headers, origin: 'https://attacker.example' } })).status()).toBe(403);
  expect((await request.post(endpoint, { data: { revision: 0 }, headers: { ...headers, 'x-preview-session': 'not-the-token' } })).status()).toBe(403);
  expect((await request.post(endpoint, { data: '{"revision":0}', headers: { ...headers, 'content-type': 'text/plain' } })).status()).toBe(415);
  expect((await request.post(endpoint, { data: JSON.stringify({ revision: 0, padding: 'x'.repeat(17_000) }), headers })).status()).toBe(413);
});

test('resizes the backing store only when composition size or DPR changes', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
    let writes = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', { ...descriptor, set(value) { writes += 1; descriptor.set!.call(this, value); } });
    Object.defineProperty(window, '__canvasWidthWrites', { get: () => writes });
  });
  await page.goto(server.url);
  await expect(page.getByTestId('connection')).toHaveText('connected');
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const initial = { width: canvas.width, height: canvas.height, writes: (window as unknown as { __canvasWidthWrites: number }).__canvasWidthWrites };
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    return new Promise<{ initial: { width: number; height: number; writes: number }; changed: { width: number; height: number; writes: number } }>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ initial, changed: { width: canvas.width, height: canvas.height, writes: (window as unknown as { __canvasWidthWrites: number }).__canvasWidthWrites } })));
    });
  });
  expect(result.changed.width).toBe(result.initial.width * 2);
  expect(result.changed.height).toBe(result.initial.height * 2);
  expect(result.changed.writes).toBe(result.initial.writes + 1);
});

test('deduplicates an in-flight render failure and recovers from a rollback conflict', async ({ page }) => {
  let reports = 0;
  let sceneReads = 0;
  await page.route('**/api/render-failed', async route => {
    reports += 1;
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ROLLBACK_FAILED' } }) });
  });
  await page.route('**/api/scene', async route => { sceneReads += 1; await route.continue(); });
  await page.goto(server.url);
  await expect(page.getByTestId('connection')).toHaveText('connected');
  await page.evaluate(() => {
    const context = document.querySelector('canvas')!.getContext('2d')!;
    const original = context.fillRect.bind(context);
    let failed = false;
    context.fillRect = (...args) => { if (!failed) { failed = true; throw new Error('synthetic draw failure'); } return original(...args); };
  });
  await expect.poll(() => reports).toBe(1);
  await expect.poll(() => sceneReads).toBeGreaterThan(0);
  await expect(page.getByRole('heading')).toHaveText('Persistent preview');
});
