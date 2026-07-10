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
const pointer = { x: 0, y: 0, active: false };

const applyScene = (next: Scene) => { scene = next; title.textContent = next.metadata.name; revision.textContent = `Revision ${next.metadata.revision}`; };
const reportFailure = async (error: unknown) => { if (scene) await fetch('/api/render-failed', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: scene.metadata.revision, message: error instanceof Error ? error.message : 'Render failed' }) }); };

function frame(now: number) {
  if (scene) {
    const elapsed = playing ? (now - started) / 1000 : pausedAt;
    try { renderer.render(evaluateScene(scene, { time: elapsed, delta: Math.min((now - previous) / 1000, .1), pointer }), scene.composition, scene.metadata.revision); }
    catch (error) { void reportFailure(error); scene = undefined; }
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
