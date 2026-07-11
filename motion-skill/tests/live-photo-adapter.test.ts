import { describe, expect, test } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Live Photo packaging adapter', () => {
  test('dry-runs a five-second Xiaohongshu JPG/MOV package', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'motion-live-'));
    const jpg = path.join(directory, 'key.jpg');
    const mov = path.join(directory, 'motion.mov');
    await writeFile(jpg, 'jpg');
    await writeFile(mov, 'mov');
    const script = path.resolve(import.meta.dirname, '../skill/scripts/package-live-photo.py');
    const result = spawnSync('python3', [script, jpg, mov, '--platform', 'xiaohongshu', '--dry-run'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ ok: true, platform: 'xiaohongshu', duration: 5 });
    expect(output.command.join(' ')).toContain('makelive==0.7.0');
  });
});
