import type { Scene } from '../model/schema';
import { createRandom } from '../math/random';
import type { CsvDataset } from './csv';
import { donutChartLayout } from './layout';

const chartPalette = ['#1747FF', '#E52521', '#F2B705', '#12A67A', '#8E44AD', '#FF6B2C', '#00A6D6', '#6B7A13'];
export type RenderedChartKind = 'bar' | 'donut' | 'line' | 'ranking-bar';
export type ChartPreference = RenderedChartKind | 'auto';

function seededColors(count: number, seed: number): string[] {
  const colors = [...chartPalette];
  const random = createRandom(seed);
  for (let index = colors.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [colors[index], colors[swap]] = [colors[swap]!, colors[index]!];
  }
  return Array.from({ length: count }, (_, index) => colors[index % colors.length]!);
}

export function composeBarChart(dataset: CsvDataset, seed = 1): Scene {
  const label = dataset.headers[0]!;
  const value = dataset.headers[1]!;
  const compositionDuration = 5;
  const points = dataset.rows.map(row => ({ label: row[label]!, value: Number(row[value]) }));
  const maximum = Math.max(...points.map(point => point.value), 1);
  const barColors = seededColors(points.length, seed);
  const elements: Scene['elements'] = [
    { id: 'title', type: 'text', text: `${value}对比`, x: 88, y: 130, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: 48 },
    { id: 'axis-x', type: 'line', x: 88, y: 820, x2: 610, y2: 820, stroke: '#111111', strokeWidth: 3 },
    { id: 'axis-y', type: 'line', x: 88, y: 320, x2: 88, y2: 820, stroke: '#111111', strokeWidth: 3 },
  ];
  const baseline = 820, barWidth = 72, firstBarLeft = 120, gap = 40;
  points.forEach((point, index) => {
    const height = Math.round(point.value / maximum * 440);
    const x = firstBarLeft + index * (barWidth + gap) + barWidth / 2;
    elements.push({ id: `bar-${index}`, type: 'rectangle', origin: 'bottom-center', x, y: baseline, width: barWidth, height, fill: barColors[index] }, { id: `value-${index}`, type: 'text', text: String(point.value), x, y: baseline - height - 22, fill: '#111111', fontFamily: 'Inter Motion', fontSize: 24 }, { id: `label-${index}`, type: 'text', text: point.label, x, y: 870, fill: '#111111', fontFamily: 'PingFang SC', fontSize: 24 });
  });
  const stagger = .3, growDuration = .62, cycle = compositionDuration;
  const behaviors = points.map((_, index) => ({ id: `bar-grow-${index}`, type: 'ramp' as const, delay: index * stagger, duration: growDuration, cycle }));
  const animation: Scene['animation'] = points.flatMap((_, index) => [
    { id: `bar-enter-${index}`, elementId: `bar-${index}`, behaviorId: `bar-grow-${index}`, falloffIds: [], channels: ['growY'], role: index === 0 ? 'primary' : 'supporting' },
    { id: `value-enter-${index}`, elementId: `value-${index}`, behaviorId: `bar-grow-${index}`, falloffIds: [], channels: ['count', 'opacity'], role: 'supporting' },
  ]);
  return { metadata: { schemaVersion: 1, revision: 0, seed, name: 'CSV 动态柱状图' }, composition: { width: 900, height: 1200, background: '#F3F1EA', duration: compositionDuration, loop: true, style: 'editorial' }, elements, generators: [], behaviors, falloffs: [], animation };
}

export function chooseAvailableChartKind(dataset: CsvDataset, preference: ChartPreference = 'auto'): RenderedChartKind {
  if (preference !== 'auto') return preference;
  if (dataset.chart === 'donut') return 'donut';
  if (dataset.chart === 'line') return 'line';
  if (dataset.chart === 'ranking-bar') return 'ranking-bar';
  return 'bar';
}

export function composeChart(dataset: CsvDataset, seed = 1, preference: ChartPreference = 'auto'): Scene {
  const kind = chooseAvailableChartKind(dataset, preference);
  if (kind === 'donut') return composeDonutChart(dataset, seed);
  if (kind === 'line') return composeLineChart(dataset, seed);
  if (kind === 'ranking-bar') return composeRankingBarChart(dataset, seed);
  return composeBarChart(dataset, seed);
}

export function composeLineChart(dataset: CsvDataset, seed = 1): Scene {
  const label = dataset.headers[0]!;
  const value = dataset.headers[1]!;
  const compositionDuration = 5;
  const points = dataset.rows.map(row => ({ label: row[label]!, value: Number(row[value]) }));
  const values = points.map(point => point.value);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const span = Math.max(1, maximum - minimum);
  const left = 112, right = 780, top = 300, bottom = 800;
  const colors = seededColors(1, seed);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (points.length === 1 ? 0 : index * (right - left) / (points.length - 1)),
    y: bottom - (point.value - minimum) / span * (bottom - top),
  }));
  const elements: Scene['elements'] = [
    { id: 'title', type: 'text', text: `${value}趋势`, x: 88, y: 130, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: 48 },
    { id: 'subtitle', type: 'text', text: '按时间依次连线', x: 88, y: 180, textAlign: 'left', fill: '#111111', opacity: .58, fontFamily: 'PingFang SC', fontSize: 22 },
    { id: 'axis-x', type: 'line', x: left, y: bottom, x2: right, y2: bottom, stroke: '#111111', strokeWidth: 3 },
    { id: 'axis-y', type: 'line', x: left, y: top, x2: left, y2: bottom, stroke: '#111111', strokeWidth: 3 },
  ];
  coordinates.slice(0, -1).forEach((point, index) => {
    const next = coordinates[index + 1]!;
    elements.push({ id: `segment-${index}`, type: 'line', x: point.x, y: point.y, x2: next.x, y2: next.y, stroke: colors[0], strokeWidth: 6, pathProgress: 1 });
  });
  coordinates.forEach((point, index) => {
    elements.push(
      { id: `point-${index}`, type: 'circle', x: point.x, y: point.y, radius: 7, fill: '#111111' },
      { id: `label-${index}`, type: 'text', text: point.label, x: point.x, y: 860, fill: '#111111', fontFamily: 'PingFang SC', fontSize: 22 },
    );
  });
  const behaviors = coordinates.slice(0, -1).map((_, index) => ({ id: `line-draw-${index}`, type: 'ramp' as const, delay: index * .28, duration: .55, cycle: compositionDuration }));
  const animation: Scene['animation'] = coordinates.slice(0, -1).map((_, index) => ({
    id: `segment-enter-${index}`, elementId: `segment-${index}`, behaviorId: `line-draw-${index}`, falloffIds: [], channels: ['pathProgress'], role: index === 0 ? 'primary' : 'supporting',
  }));
  return { metadata: { schemaVersion: 1, revision: 0, seed, name: 'CSV 动态折线图' }, composition: { width: 900, height: 1200, background: '#F3F1EA', duration: compositionDuration, loop: true, style: 'editorial' }, elements, generators: [], behaviors, falloffs: [], animation };
}

export function composeRankingBarChart(dataset: CsvDataset, seed = 1): Scene {
  const label = dataset.headers[0]!;
  const value = dataset.headers[1]!;
  const compositionDuration = 5;
  const points = dataset.rows.map(row => ({ label: row[label]!, value: Number(row[value]) })).sort((a, b) => b.value - a.value).slice(0, 10);
  const maximum = Math.max(...points.map(point => point.value), 1);
  const colors = seededColors(points.length, seed);
  const elements: Scene['elements'] = [
    { id: 'title', type: 'text', text: `${value}排行`, x: 88, y: 130, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: 48 },
    { id: 'subtitle', type: 'text', text: '由高到低依次刷出', x: 88, y: 180, textAlign: 'left', fill: '#111111', opacity: .58, fontFamily: 'PingFang SC', fontSize: 22 },
  ];
  const startY = points.length > 8 ? 300 : 340;
  const rowGap = points.length > 8 ? 64 : 74;
  const labelX = 88, barX = 260, barMax = 470, barHeight = 34;
  points.forEach((point, index) => {
    const y = startY + index * rowGap;
    const width = Math.round(point.value / maximum * barMax);
    elements.push(
      { id: `rank-label-${index}`, type: 'text', text: point.label, x: labelX, y: y + 26, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: 26 },
      { id: `rank-bar-${index}`, type: 'rectangle', x: barX, y, width, height: barHeight, fill: colors[index] },
      { id: `rank-value-${index}`, type: 'text', text: String(point.value), x: barX + width + 22, y: y + 26, textAlign: 'left', fill: '#111111', fontFamily: 'Inter Motion', fontSize: 24 },
    );
  });
  const behaviors = points.map((_, index) => ({ id: `rank-grow-${index}`, type: 'ramp' as const, delay: index * .22, duration: .58, cycle: compositionDuration }));
  const animation: Scene['animation'] = points.flatMap((_, index) => [
    { id: `rank-bar-enter-${index}`, elementId: `rank-bar-${index}`, behaviorId: `rank-grow-${index}`, falloffIds: [], channels: ['growX'], role: index === 0 ? 'primary' : 'supporting' },
    { id: `rank-value-enter-${index}`, elementId: `rank-value-${index}`, behaviorId: `rank-grow-${index}`, falloffIds: [], channels: ['count', 'opacity'], role: 'supporting' },
  ]);
  return { metadata: { schemaVersion: 1, revision: 0, seed, name: 'CSV 动态排名条形图' }, composition: { width: 900, height: 1200, background: '#F3F1EA', duration: compositionDuration, loop: true, style: 'editorial' }, elements, generators: [], behaviors, falloffs: [], animation };
}

export function composeDonutChart(dataset: CsvDataset, seed = 1): Scene {
  const label = dataset.headers[0]!;
  const value = dataset.headers[1]!;
  const compositionDuration = 5;
  const points = dataset.rows.map(row => ({ label: row[label]!, value: Number(row[value]) })).filter(point => point.value > 0);
  const total = points.reduce((sum, point) => sum + point.value, 0) || 1;
  const colors = seededColors(points.length, seed);
  const layout = donutChartLayout(points.length);
  const chart = layout.chart;
  const elements: Scene['elements'] = [
    { id: 'title', type: 'text', text: `${value}构成`, x: 88, y: 130, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: 48 },
    { id: 'subtitle', type: 'text', text: '按占比依次扫出', x: 88, y: 180, textAlign: 'left', fill: '#111111', opacity: .58, fontFamily: 'PingFang SC', fontSize: 22 },
    { id: 'total-label', type: 'text', text: 'TOTAL', x: chart.x, y: chart.totalLabelY, fill: '#111111', opacity: .5, fontFamily: 'Inter Motion', fontSize: 22, letterSpacing: 2 },
    { id: 'total-value', type: 'text', text: String(total), x: chart.x, y: chart.totalValueY, fill: '#111111', fontFamily: 'Inter Motion', fontSize: 56 },
  ];
  let angle = -Math.PI / 2;
  const legendRowsPerColumn = layout.legend.rowsPerColumn;
  const legendStartY = layout.legend.startY;
  const legendGap = layout.legend.gap;
  const legendColumns = [
    { swatchX: 132, labelX: 178, valueX: 340 },
    { swatchX: 474, labelX: 520, valueX: 682 },
  ];
  points.forEach((point, index) => {
    const sweep = Math.PI * 2 * point.value / total;
    const percent = `${Math.round(point.value / total * 100)}%`;
    const column = layout.legend.columns === 2 ? Math.floor(index / legendRowsPerColumn) : 0;
    const row = layout.legend.columns === 2 ? index % legendRowsPerColumn : index;
    const legend = legendColumns[column] ?? legendColumns[0]!;
    const y = legendStartY + row * legendGap;
    const legendFontSize = layout.legend.fontSize;
    const swatchSize = layout.legend.swatchSize;
    elements.push(
      { id: `slice-${index}`, type: 'sector', x: chart.x, y: chart.y, innerRadius: chart.innerRadius, outerRadius: chart.outerRadius, startAngle: angle, endAngle: angle + sweep, pathProgress: 1, fill: colors[index] },
      { id: `legend-swatch-${index}`, type: 'rectangle', x: legend.swatchX, y: y - 18, width: swatchSize, height: swatchSize, fill: colors[index] },
      { id: `legend-label-${index}`, type: 'text', text: point.label, x: legend.labelX, y, textAlign: 'left', fill: '#111111', fontFamily: 'PingFang SC', fontSize: legendFontSize },
      { id: `legend-value-${index}`, type: 'text', text: percent, x: legend.valueX, y, textAlign: 'left', fill: '#111111', fontFamily: 'Inter Motion', fontSize: legendFontSize },
      { id: `legend-row-${index}`, type: 'group', childIds: [`legend-swatch-${index}`, `legend-label-${index}`, `legend-value-${index}`] },
    );
    angle += sweep;
  });
  const stagger = .24, sweepDuration = .7, cycle = compositionDuration;
  const behaviors = [
    { id: 'total-count', type: 'ramp' as const, delay: 0, duration: Math.min(1.4, points.length * stagger + sweepDuration), cycle },
    ...points.map((_, index) => ({ id: `slice-sweep-${index}`, type: 'ramp' as const, delay: index * stagger, duration: sweepDuration, cycle })),
  ];
  const animation: Scene['animation'] = points.flatMap((_, index) => [
    { id: `slice-enter-${index}`, elementId: `slice-${index}`, behaviorId: `slice-sweep-${index}`, falloffIds: [], channels: ['pathProgress'], role: index === 0 ? 'primary' : 'supporting' },
    { id: `legend-value-enter-${index}`, elementId: `legend-value-${index}`, behaviorId: `slice-sweep-${index}`, falloffIds: [], channels: ['count', 'opacity'], role: 'supporting' },
  ]);
  animation.push({ id: 'total-value-count', elementId: 'total-value', behaviorId: 'total-count', falloffIds: [], channels: ['count', 'opacity'], role: 'supporting' });
  return { metadata: { schemaVersion: 1, revision: 0, seed, name: 'CSV 动态饼状图' }, composition: { width: 900, height: 1200, background: '#F3F1EA', duration: compositionDuration, loop: true, style: 'editorial' }, elements, generators: [], behaviors, falloffs: [], animation };
}
