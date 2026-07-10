import { describe, expect, it, vi } from 'vitest';
import { CanvasRenderer } from '../src/render/canvas-renderer';
import type { RenderInstance } from '../src/evaluate/scene';

vi.stubGlobal('window', { devicePixelRatio: 1 });

const composition = { width: 320, height: 180, background: '#000', duration: 1, loop: true, style: 'geometric' } as const;

function harness() {
  const metrics = (content: string) => ({ width: content.length * 10 }) as TextMetrics;
  const context = {
    setTransform: vi.fn(), fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), roundRect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(metrics), globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context } as unknown as HTMLCanvasElement;
  return { renderer: new CanvasRenderer(canvas), context };
}

const text = (content: string): RenderInstance => ({ instanceId: `text:${content}`, id: 'text', type: 'text', text: content, content, split: 'characters', x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 } as RenderInstance);

describe('CanvasRenderer', () => {
  it('throws unsupported types with instance and revision context', () => {
    const { renderer } = harness();
    const unsupported = { instanceId: 'future:7', id: 'future', type: 'future-shape', x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 } as unknown as RenderInstance;
    expect(() => renderer.render([unsupported], composition, 12)).toThrow(/future:7.*revision 12/u);
  });

  it('uses measured text width for placement and bounds metrics with LRU eviction', () => {
    const { renderer, context } = harness();
    renderer.render([text('first')], composition);
    expect(context.fillText).toHaveBeenLastCalledWith('first', -25, 0);
    for (let index = 0; index < 256; index += 1) renderer.render([text(`value-${index}`)], composition);
    renderer.render([text('first')], composition);
    expect(context.measureText).toHaveBeenCalledTimes(258);
  });
});
