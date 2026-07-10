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

  const response = await page.request.post(`${server.url}api/render-failed`, { data: { revision: 1, message: 'draw exploded' } });
  expect(response.ok()).toBeTruthy();
  await expect(page.getByTestId('revision')).toHaveText('Revision 2');
  await expect(page.getByRole('heading')).toHaveText('Persistent preview');
});
