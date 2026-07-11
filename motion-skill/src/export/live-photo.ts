import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { Scene } from '../model/schema';
import { startPreviewServer } from '../runtime/server';

export interface LivePhotoExportOptions {
  stateDir: string;
  scene: Scene;
  outDir: string;
  fps?: number;
  platform?: 'xiaohongshu' | 'wechat';
  dryRun?: boolean;
  packageLivePhoto?: boolean;
}

export interface LivePhotoExportResult {
  ok: true;
  format: 'live-photo';
  platform: 'xiaohongshu' | 'wechat';
  duration: number;
  fps: number;
  audio: false;
  filters: false;
  dryRun: boolean;
  assets: { jpg: string; mov: string; pvt: string; zip: string; readme: string };
  packaged: boolean;
  packageCommand: string[];
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? 'unknown status'}`)));
  });
}

const frameName = (index: number) => `frame-${String(index).padStart(5, '0')}.png`;
const packageScript = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skill/scripts/package-live-photo.py');

export function livePhotoExportPlan(options: LivePhotoExportOptions): LivePhotoExportResult {
  const platform = options.platform ?? 'xiaohongshu';
  const duration = platform === 'xiaohongshu' ? 5 : 3;
  const fps = options.fps ?? 30;
  const outDir = path.resolve(options.outDir);
  const jpg = path.join(outDir, 'key.jpg');
  const mov = path.join(outDir, 'motion.mov');
  const pvt = path.join(outDir, 'key.pvt');
  const zip = path.join(outDir, 'key.pvt.zip');
  const readme = path.join(outDir, 'README.txt');
  const packageCommand = ['python3', packageScript(), jpg, mov, '--platform', platform];
  return {
    ok: true,
    format: 'live-photo',
    platform,
    duration,
    fps,
    audio: false,
    filters: false,
    dryRun: options.dryRun ?? false,
    assets: { jpg, mov, pvt, zip, readme },
    packaged: false,
    packageCommand,
  };
}

function readmeText(plan: LivePhotoExportResult) {
  return [
    'Motion Scene Live Photo Export',
    '',
    'Files:',
    `- key.pvt: Live Photo bundle. AirDrop this folder/package to iPhone for Live Photo import.`,
    `- key.pvt.zip: Transfer copy for WeChat, cloud drive, or archive. Unzip on Mac before AirDrop.`,
    `- key.jpg: Still key image.`,
    `- motion.mov: Silent motion video preview; this is not a Live Photo by itself.`,
    '',
    `Platform: ${plan.platform}`,
    `Duration: ${plan.duration}s`,
    `FPS: ${plan.fps}`,
    'Audio: false',
    'Filters: false',
    '',
  ].join('\n');
}

export async function exportLivePhoto(options: LivePhotoExportOptions): Promise<LivePhotoExportResult> {
  const plan = livePhotoExportPlan(options);
  if (options.dryRun) return plan;

  const outDir = path.resolve(options.outDir);
  const framesDir = path.join(outDir, 'frames');
  await mkdir(framesDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(plan.assets.readme, readmeText(plan));

  const server = await startPreviewServer({ port: 0, stateDir: options.stateDir });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: options.scene.composition.width + 160, height: options.scene.composition.height + 160 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(server.url);
    await page.waitForFunction(() => {
      const revision = (window as unknown as { __motionTest?: { revision: number | null } }).__motionTest?.revision;
      return revision !== undefined && revision !== null;
    }, undefined, { timeout: 10_000 });

    const capture = async (time: number, mime: 'image/png' | 'image/jpeg', quality?: number) => page.evaluate(({ time, mime, quality }) => {
      const hook = (window as unknown as { __motionTest: { renderAt(time: number): void } }).__motionTest;
      hook.renderAt(time);
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Scene canvas missing');
      return canvas.toDataURL(mime, quality).split(',')[1]!;
    }, { time, mime, quality });

    const keyTime = Math.max(0, Math.min(plan.duration - 1 / plan.fps, plan.duration * 0.72));
    await writeFile(plan.assets.jpg, Buffer.from(await capture(keyTime, 'image/jpeg', .94), 'base64'));

    const frameCount = Math.max(1, Math.round(plan.duration * plan.fps));
    for (let index = 0; index < frameCount; index += 1) {
      const time = index / plan.fps;
      await writeFile(path.join(framesDir, frameName(index)), Buffer.from(await capture(time, 'image/png'), 'base64'));
    }
  } finally {
    await browser.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }

  await run('ffmpeg', [
    '-y',
    '-framerate', String(plan.fps),
    '-i', path.join(framesDir, 'frame-%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', String(plan.fps),
    '-movflags', '+faststart',
    '-an',
    plan.assets.mov,
  ], outDir);
  await rm(framesDir, { recursive: true, force: true });

  const shouldPackage = options.packageLivePhoto ?? true;
  if (shouldPackage) {
    await run(plan.packageCommand[0]!, plan.packageCommand.slice(1), outDir);
    await run('ditto', ['-c', '-k', '--keepParent', plan.assets.pvt, plan.assets.zip], outDir);
  }
  return { ...plan, packaged: shouldPackage };
}
