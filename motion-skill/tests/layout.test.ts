import { describe, expect, test } from 'vitest';
import { centeredPair, leftTextBlock } from '../src/layout/anchors';
import { relationEdge } from '../src/layout/relations';

describe('infographic layout primitives', () => {
  test('anchors every title line to one left edge', () => {
    const lines = leftTextBlock('天气和肤质，如何影响\n化妆品销量？', { left: 88, top: 155, fontSize: 48, lineHeight: 58 });
    expect(lines).toEqual([
      { text: '天气和肤质，如何影响', x: 328, y: 155 },
      { text: '化妆品销量？', x: 232, y: 213 },
    ]);
  });

  test('centers a pair by their total visual bounds', () => {
    expect(centeredPair({ canvasWidth: 900, leftRadius: 120, rightRadius: 120, gap: 100, y: 490 })).toEqual({ left: { x: 280, y: 490 }, right: { x: 620, y: 490 } });
  });

  test('attaches arrowheads to the final edge tangent outside node bounds', () => {
    const edge = relationEdge({ from: { x: 280, y: 490, radius: 120 }, to: { x: 450, y: 875, radius: 132 }, clearance: 14 });
    expect(edge.start.y).toBeGreaterThan(490);
    expect(edge.end.y).toBeLessThan(875);
    expect(edge.arrow.rotation).toBeCloseTo(Math.atan2(edge.end.y - edge.start.y, edge.end.x - edge.start.x));
  });
});
