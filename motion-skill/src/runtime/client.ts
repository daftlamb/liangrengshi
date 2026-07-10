import { evaluateScene } from '../evaluate/scene';
import type { Scene } from '../model/schema';
import { CanvasRenderer } from '../render/canvas-renderer';

const canvas = document.querySelector('canvas')!;
const renderer = new CanvasRenderer(canvas);
const title = document.querySelector('h1')!;
const revision = document.querySelector<HTMLElement>('[data-testid="revision"]')!;
const connection = document.querySelector<HTMLElement>('[data-testid="connection"]')!;
const main = document.querySelector('main')!;
let scene: Scene | undefined;
let playing = true;
let started = performance.now();
let pausedAt = 0;
let previous = performance.now();
let reconnectAttempt = 0;
let sessionToken: string | undefined;
const failureReports = new Map<number, Promise<void>>();
const pointer = { x: 0, y: 0, active: false };

const applyScene = (next: Scene) => { scene = next; title.textContent = next.metadata.name; revision.textContent = `Revision ${next.metadata.revision}`; };
const fetchScene = async (): Promise<void> => {
  try {
    const response = await fetch('/api/scene');
    if (!response.ok) throw new Error(`Scene request failed (${response.status})`);
    applyScene(await response.json() as Scene);
  } catch {
    // SSE reconnect or a later recovery attempt will restore the scene.
  }
};
const getSessionToken = async (): Promise<string> => {
  if (sessionToken) return sessionToken;
  const response = await fetch('/api/session');
  if (!response.ok) throw new Error(`Session request failed (${response.status})`);
  sessionToken = (await response.json() as { token: string }).token;
  return sessionToken;
};
const reportFailure = (failedScene: Scene, error: unknown): Promise<void> => {
  const failedRevision = failedScene.metadata.revision;
  const existing = failureReports.get(failedRevision);
  if (existing) return existing;
  const report = (async () => {
    try {
      const token = await getSessionToken();
      const response = await fetch('/api/render-failed', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-preview-session': token },
        body: JSON.stringify({ revision: failedRevision, message: error instanceof Error ? error.message : 'Render failed' }),
      });
      if (!response.ok) { await fetchScene(); return; }
      const result = await response.json() as { scene?: Scene };
      if (result.scene) applyScene(result.scene); else await fetchScene();
    } catch { await fetchScene(); }
    finally { failureReports.delete(failedRevision); }
  })();
  failureReports.set(failedRevision, report);
  return report;
};

function frame(now: number) {
  if (scene) {
    const elapsed = playing ? (now - started) / 1000 : pausedAt;
    try { renderer.render(evaluateScene(scene, { time: elapsed, delta: Math.min((now - previous) / 1000, .1), pointer }), scene.composition, scene.metadata.revision); }
    catch (error) { const failedScene = scene; scene = undefined; void reportFailure(failedScene, error); }
  }
  previous = now;
  requestAnimationFrame(frame);
}

function connect() {
  connection.textContent = 'connecting';
  const source = new EventSource('/api/events');
  source.addEventListener('revision', event => { reconnectAttempt = 0; connection.textContent = 'connected'; applyScene(JSON.parse((event as MessageEvent).data) as Scene); });
  source.onerror = () => {
    source.close(); connection.textContent = 'disconnected';
    const delay = Math.min(500 * 2 ** reconnectAttempt++, 8_000);
    setTimeout(connect, delay);
  };
}

canvas.addEventListener('pointermove', event => { const bounds = canvas.getBoundingClientRect(); pointer.x = (event.clientX - bounds.left) * (scene?.composition.width ?? 1) / bounds.width; pointer.y = (event.clientY - bounds.top) * (scene?.composition.height ?? 1) / bounds.height; pointer.active = true; });
canvas.addEventListener('pointerleave', () => { pointer.active = false; });
document.querySelector('#play')!.addEventListener('click', event => { const button = event.currentTarget as HTMLButtonElement; playing = !playing; if (playing) { started = performance.now() - pausedAt * 1000; button.textContent = 'Pause'; } else { pausedAt = (performance.now() - started) / 1000; button.textContent = 'Play'; } });
document.querySelector('#restart')!.addEventListener('click', () => { started = performance.now(); pausedAt = 0; });
document.querySelector('#grid')!.addEventListener('click', () => main.classList.toggle('show-grid'));
document.querySelector('#safe-area')!.addEventListener('click', () => main.classList.toggle('show-safe-area'));
document.querySelector('#fullscreen')!.addEventListener('click', () => void (document.fullscreenElement ? document.exitFullscreen() : main.requestFullscreen()));

connect(); requestAnimationFrame(frame);
