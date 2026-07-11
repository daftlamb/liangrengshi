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

  test('uses anchored title lines and automatically aligned arrowheads', () => {
    const scene = composeDiagramCard({ text: '天气和肤质导致化妆品销量降低', seed: 8 });
    expect(scene.elements.filter(element => element.id.startsWith('title-')).length).toBeGreaterThanOrEqual(1);
    expect(scene.elements.filter(element => element.id.endsWith('-arrow'))).toHaveLength(2);
  });

  test('aligns every text hierarchy to the same left grid', () => {
    const scene = composeDiagramCard({ text: '天气和肤质导致化妆品销量降低', seed: 8 });
    const eyebrow = scene.elements.find(element => element.id === 'eyebrow');
    const title = scene.elements.find(element => element.id === 'title-0');
    const caption = scene.elements.find(element => element.id === 'caption');
    expect(eyebrow).toMatchObject({ x: 88, textAlign: 'left' });
    expect(title).toMatchObject({ x: 88, y: 180, textAlign: 'left' });
    expect(caption).toMatchObject({ x: 88, textAlign: 'left' });
  });

  test('wraps a result label inside its circle with a safe inset', () => {
    const scene = composeDiagramCard({ text: '天气和肤质导致化妆品销量降低', seed: 8 });
    const label = scene.elements.find(element => element.id === 'result-label');
    expect(label).toMatchObject({ text: '化妆品\n销量降低', lineHeight: 38 });
  });

  test('adds a quiet dot matrix or grid only when requested', () => {
    const dots = composeDiagramCard({ text: '冷链波动和价格导致生鲜销量降低', seed: 12, direction: { background: 'dot-matrix' } as never });
    const grid = composeDiagramCard({ text: '冷链波动和价格导致生鲜销量降低', seed: 12, direction: { background: 'grid' } as never });
    expect(dots.generators).toContainEqual(expect.objectContaining({ id: 'background-dots', type: 'grid', columns: 12, rows: 16 }));
    expect(dots.elements.find(element => element.id === 'background-dot')).toMatchObject({ type: 'circle', radius: 3, fill: '#C9C7C0' });
    expect(grid.elements.filter(element => element.id.startsWith('background-grid-'))).toHaveLength(25);
  });

  test('renders a three-stage timeline when requested', () => {
    const scene = composeDiagramCard({ text: '冷启动、增长、复购构成增长路径', seed: 13, direction: { composition: 'timeline' } as never });
    expect(scene.elements.filter(element => element.id.startsWith('timeline-node-'))).toHaveLength(3);
    expect(scene.elements.filter(element => element.id.startsWith('timeline-edge-'))).toHaveLength(2);
  });
});
