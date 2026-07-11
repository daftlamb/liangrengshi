import { describe, expect, test } from 'vitest';
import { composeDiagramCard } from '../src/opinion/diagram';
import { validateScene } from '../src/model/validate';

describe('diagram cards', () => {
  test('turns a contrast opinion into labeled nodes and a relation edge', () => {
    const scene = composeDiagramCard({ text: '真正的壁垒不是模型能力而是进入日常工作流', seed: 8 });
    expect(scene.composition).toMatchObject({ width: 900, height: 1200, duration: 5 });
    expect(scene.elements.filter(element => element.type === 'circle')).toHaveLength(2);
    expect(scene.elements.some(element => element.type === 'line')).toBe(true);
    expect(scene.elements.filter(element => element.type === 'text').map(element => element.text).join(' ')).toContain('模型能力');
    expect(validateScene(scene).valid).toBe(true);
  });

  test('derives node labels from a focus opinion when it has no explicit emphasis', () => {
    const scene = composeDiagramCard({ text: '真正有洞察的观点不一定让人愉悦', seed: 8 });
    const labels = scene.elements.filter(element => element.type === 'text').map(element => element.text);
    expect(labels).toContain('洞察');
    expect(labels).toContain('愉悦');
  });
});
