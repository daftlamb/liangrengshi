import { describe, expect, it } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const skillPath = path.join(root, 'skill/SKILL.md');

describe('motion skill contract', () => {
  it('has natural-language triggering frontmatter', async () => {
    const text = await readFile(skillPath, 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    expect(match?.[1]).toMatch(/^name: motion-scene$/m);
    expect(match?.[1]).toMatch(/^description: .*natural-language.*motion.*animation/im);
  });

  it('references existing focused guidance', async () => {
    const text = await readFile(skillPath, 'utf8');
    const links = [...text.matchAll(/\]\((references\/[^)]+)\)/g)].map(([, link]) => link);
    expect(links.sort()).toEqual(['references/motion-language.md', 'references/scene-schema.md', 'references/visual-quality.md']);
    await Promise.all(links.map(link => access(path.join(root, 'skill', link))));
  });

  it('documents every conversational branch and safety invariant', async () => {
    const text = await readFile(skillPath, 'utf8');
    for (const phrase of ['Create', 'Update', 'Undo', 'Unsupported', 'Ambiguous', 'status first', 'smallest JSON Patch', 'validate before', '--preserve', 'reuse', 'budget reduction', 'one focused question']) {
      expect(text, phrase).toContain(phrase);
    }
  });

  it('executes every complete documented CLI command in help dry-parse mode', async () => {
    const text = await readFile(skillPath, 'utf8');
    const prefix = 'npm exec -- vite-node src/cli/motion-scene.ts ';
    const commands = [...text.matchAll(/^npm exec -- vite-node src\/cli\/motion-scene\.ts (.+)$/gm)]
      .map(([, args]) => args.trim().split(/\s+/));
    expect(commands.length).toBeGreaterThan(5);
    for (const args of commands) {
      const command = args[0];
      const result = spawnSync('npm', ['exec', '--', 'vite-node', 'src/cli/motion-scene.ts', ...args, '--help'], { cwd: root, encoding: 'utf8' });
      expect(result.status, `${prefix}${args.join(' ')}\n${result.stdout}${result.stderr}`).toBe(0);
      expect(JSON.parse(result.stdout), command).toMatchObject({ ok: true, help: true, command });
    }

    const mutated = [...commands[0]];
    mutated.push('--state-dri', '.motion-scene', '--help');
    const result = spawnSync('npm', ['exec', '--', 'vite-node', 'src/cli/motion-scene.ts', ...mutated], { cwd: root, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Unknown option: --state-dri/);
  }, 20_000);

  it('documents an executable cwd-independent preview wrapper', async () => {
    const text = await readFile(skillPath, 'utf8');
    expect(text).toContain('skill/scripts/preview.sh --state-dir .motion-scene --port 0');
    const result = spawnSync(path.join(root, 'skill/scripts/preview.sh'), ['--state-dir', '.motion-scene', '--port', '0', '--help'], { cwd: path.dirname(root), encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, help: true, command: 'serve' });
  });
});
