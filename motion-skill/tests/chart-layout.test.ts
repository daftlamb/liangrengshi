import { expect, test } from 'vitest';
import { donutChartLayout } from '../src/data/layout';

test('keeps multi-slice donut charts clear of the legend area', () => {
  const layout = donutChartLayout(10);
  expect(layout.legend.columns).toBe(2);
  expect(layout.legend.startY - (layout.chart.y + layout.chart.outerRadius)).toBeGreaterThanOrEqual(48);
  expect(layout.legend.fontSize).toBeLessThan(26);
});

test('keeps small donut charts roomy with a single legend column', () => {
  const layout = donutChartLayout(4);
  expect(layout.legend.columns).toBe(1);
  expect(layout.chart.outerRadius).toBe(260);
  expect(layout.legend.fontSize).toBe(26);
});
