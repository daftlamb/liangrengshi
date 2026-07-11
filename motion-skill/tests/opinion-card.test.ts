import { describe, expect, test } from 'vitest';
import { analyzeOpinion, composeOpinionCard } from '../src/opinion/compose';
import { validateScene } from '../src/model/validate';

describe('modernist opinion cards', () => {
  test.each([
    ['真正的壁垒不是模型能力而是进入日常工作流', 'contrast'],
    ['产品增长最终取决于用户是否愿意形成日常习惯', 'converge'],
    ['信任一旦下降就会导致整个协作网络逐渐失效', 'propagate'],
    ['真正有价值的设计总能让复杂选择变得简单', 'focus'],
  ] as const)('infers %s as %s', (text, relation) => {
    expect(analyzeOpinion(text).relation).toBe(relation);
  });

  test('rejects opinions outside 12–40 Chinese characters', () => {
    expect(() => analyzeOpinion('太短')).toThrow(/12–40/);
    expect(() => analyzeOpinion('这是一句'.repeat(11))).toThrow(/12–40/);
  });

  test('keeps no more than two emphasis phrases', () => {
    const analysis = analyzeOpinion('真正的壁垒不是模型能力而是进入日常工作流');
    expect(analysis.emphasis.length).toBeLessThanOrEqual(2);
    expect(analysis.emphasis).toContain('日常工作流');
  });

  test('composes a deterministic valid 3:4 five-second scene', () => {
    const input = { text: '真正的壁垒不是模型能力而是进入日常工作流', seed: 77 };
    const scene = composeOpinionCard(input);
    expect(scene).toEqual(composeOpinionCard(input));
    expect(scene.composition).toMatchObject({ width: 900, height: 1200, duration: 5, style: 'editorial' });
    expect(scene.composition.background).toBe('#F3F1EA');
    expect(scene.metadata.name).toContain('观点卡');
    expect(scene.animation.length).toBeLessThanOrEqual(3);
    expect(validateScene(scene).valid).toBe(true);
  });

  test('keeps centered label and emphasis text inside the left card edge', () => {
    const scene = composeOpinionCard({ text: '真正的壁垒不是模型能力而是进入日常工作流', seed: 77 });
    const label = scene.elements.find(element => element.id === 'label');
    const emphasis = scene.elements.find(element => element.id === 'emphasis');
    expect(label).toMatchObject({ type: 'text', x: 230 });
    expect(emphasis).toMatchObject({ type: 'text', x: 250 });
  });
});
