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

  it('only demonstrates real CLI commands and options', async () => {
    const text = await readFile(skillPath, 'utf8');
    const commands = [...text.matchAll(/^motion-scene (.+)$/gm)].map(([, args]) => args.trim().split(/\s+/));
    expect(commands.length).toBeGreaterThan(5);
    const cli = path.join(root, 'src/cli/motion-scene.ts');
    const runner = path.join(root, 'node_modules/.bin/vite-node');
    for (const args of commands) {
      const command = args[0];
      const result = spawnSync(runner, [cli, command, '--help'], { encoding: 'utf8' });
      expect(result.stdout, command).toMatch(/"code":"INVALID_ARGUMENT"/);
      expect(result.stdout, command).not.toMatch(/Unknown command/);
    }
  });
});
