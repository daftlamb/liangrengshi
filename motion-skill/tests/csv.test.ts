import { expect, test } from 'vitest';
import { composeBarChart, composeChart, composeDonutChart, composeLineChart, composeRankingBarChart } from '../src/data/chart';
import { parseCsv } from '../src/data/csv';
import { validateScene } from '../src/model/validate';

test('recommends chart types from common CSV shapes', () => {
  expect(parseCsv('品类,销量\n护肤,42\n彩妆,31').chart).toBe('donut');
  expect(parseCsv('月份,销量\n1月,42\n2月,31').chart).toBe('line');
  expect(parseCsv('排名,销量\n防晒,86\n粉底液,74\n面霜,71\n精华,67\n散粉,62\n口红,58\n卸妆,55').chart).toBe('ranking-bar');
  expect(parseCsv('城市,销量\n北京,1\n上海,2\n广州,3\n深圳,4\n成都,5\n杭州,6\n武汉,7').chart).toBe('bar');
});

test('composes slow sequential bottom-centered bar growth with axes and values', () => {
  const scene = composeBarChart(parseCsv('品类,销量\n护肤,42\n彩妆,31\n香水,18\n洗护,26'));
  const bars = scene.elements.filter(element => element.type === 'rectangle');
  expect(scene.elements.find(element => element.id === 'axis-x')).toMatchObject({ type: 'line', y: 820 });
  expect(scene.elements.find(element => element.id === 'axis-y')).toMatchObject({ type: 'line', x: 88 });
  expect(bars).toHaveLength(4);
  expect(bars.every(bar => bar.type === 'rectangle' && bar.origin === 'bottom-center' && bar.y === 820)).toBe(true);
  expect(scene.animation.filter(binding => binding.channels.includes('growY'))).toHaveLength(4);
  expect(scene.elements.filter(element => element.id.startsWith('value-'))).toHaveLength(4);
  expect(scene.animation.filter(binding => binding.elementId.startsWith('value-')).every(binding => binding.channels.includes('count') && binding.channels.includes('opacity'))).toBe(true);
  expect(scene.behaviors.slice(0, 2)).toMatchObject([
    { id: 'bar-grow-0', delay: 0, duration: .62, cycle: 5 },
    { id: 'bar-grow-1', delay: .3, duration: .62, cycle: 5 },
  ]);
  expect(scene.behaviors.every(behavior => behavior.type !== 'ramp' || behavior.cycle === scene.composition.duration)).toBe(true);
});

test('assigns distinct seeded colors to bars by default', () => {
  const dataset = parseCsv('品类,销量\n护肤,42\n彩妆,31\n香水,18\n洗护,26');
  const fills = (seed: number) => composeBarChart(dataset, seed).elements
    .filter(element => element.type === 'rectangle')
    .map(element => element.fill);
  expect(new Set(fills(31)).size).toBe(4);
  expect(fills(31)).toEqual(fills(31));
  expect(fills(31)).not.toEqual(fills(32));
});

test('composes a seeded animated donut chart with legend and sweep timing', () => {
  const scene = composeDonutChart(parseCsv('渠道,占比\n小红书,36\n抖音,28\n天猫,21\n线下,15'), 41);
  const sectors = scene.elements.filter(element => element.type === 'sector');
  expect(scene.composition).toMatchObject({ width: 900, height: 1200, duration: 5 });
  expect(sectors).toHaveLength(4);
  expect(sectors[0]).toMatchObject({ innerRadius: 150, outerRadius: 260, startAngle: -Math.PI / 2, pathProgress: 1 });
  expect(new Set(sectors.map(sector => sector.fill)).size).toBe(4);
  expect(scene.elements.filter(element => element.id.startsWith('legend-swatch-'))).toHaveLength(4);
  const totalLabel = scene.elements.find(element => element.id === 'total-label');
  const totalValue = scene.elements.find(element => element.id === 'total-value');
  expect(totalLabel?.type === 'text' && totalValue?.type === 'text' && totalValue.y! - totalLabel.y!).toBe(55);
  expect(scene.animation.find(binding => binding.elementId === 'total-value')?.channels).toEqual(['count', 'opacity']);
  expect(scene.animation.filter(binding => binding.elementId.startsWith('legend-value-')).every(binding => binding.channels.includes('count') && binding.channels.includes('opacity'))).toBe(true);
  expect(scene.animation.filter(binding => binding.channels.includes('pathProgress'))).toHaveLength(4);
  expect(scene.behaviors.every(behavior => behavior.type !== 'ramp' || behavior.cycle === scene.composition.duration)).toBe(true);
});

test('keeps six-slice donut charts inside the v1 animation budget', () => {
  const scene = composeDonutChart(parseCsv('渠道,占比\n小红书,24\n抖音,22\n天猫,18\n线下,14\n私域,12\n其他,10'), 42);
  expect(scene.elements.filter(element => element.type === 'sector')).toHaveLength(6);
  expect(scene.animation.filter(binding => binding.role === 'supporting')).toHaveLength(12);
  expect(scene.animation.filter(binding => binding.channels.includes('pathProgress'))).toHaveLength(6);
});

test('automatically composes the available chart that matches the parsed CSV shape', () => {
  const donut = composeChart(parseCsv('渠道,占比\n小红书,36\n抖音,28\n天猫,21\n线下,15'), 41);
  expect(donut.metadata.name).toBe('CSV 动态饼状图');
  expect(donut.elements.some(element => element.type === 'sector')).toBe(true);

  const bar = composeChart(parseCsv('城市,销量\n北京,1\n上海,2\n广州,3\n深圳,4\n成都,5\n杭州,6\n武汉,7'), 41);
  expect(bar.metadata.name).toBe('CSV 动态柱状图');
  expect(bar.elements.find(element => element.id === 'axis-y')).toMatchObject({ type: 'line', x: 88 });
});

test('honors an explicit donut request even when CSV auto detection prefers bars', () => {
  const scene = composeChart(parseCsv('品类,销量指数\n防晒,86\n粉底液,74\n散粉,62\n口红,58\n面霜,71\n精华,67\n洁面,49\n香水,43\n卸妆,55\n身体乳,38'), 7, 'donut');
  expect(scene.metadata.name).toBe('CSV 动态饼状图');
  expect(scene.elements.filter(element => element.type === 'sector')).toHaveLength(10);
});

test('lays out ten-slice donut legends inside the vertical card', () => {
  const scene = composeDonutChart(parseCsv('品类,销量指数\n防晒,86\n粉底液,74\n散粉,62\n口红,58\n面霜,71\n精华,67\n洁面,49\n香水,43\n卸妆,55\n身体乳,38'), 7);
  const labels = scene.elements.filter(element => element.type === 'text' && element.id.startsWith('legend-label-'));
  const sectors = scene.elements.filter(element => element.type === 'sector');
  const swatches = scene.elements.filter(element => element.type === 'rectangle' && element.id.startsWith('legend-swatch-'));
  expect(labels).toHaveLength(10);
  expect(Math.max(...labels.map(label => label.y ?? 0))).toBeLessThanOrEqual(1040);
  expect(new Set(labels.map(label => label.x))).toEqual(new Set([178, 520]));
  expect(Math.min(...swatches.map(swatch => swatch.y ?? 0)) - Math.max(...sectors.map(sector => (sector.y ?? 0) + ('outerRadius' in sector ? sector.outerRadius : 0)))).toBeGreaterThanOrEqual(48);
  expect(validateScene(scene)).toMatchObject({ valid: true, errors: [] });
});

test('composes a time-series CSV as a progressive line chart', () => {
  const scene = composeLineChart(parseCsv('月份,销量\n1月,32\n2月,38\n3月,35\n4月,49\n5月,58\n6月,64'), 9);
  expect(scene.metadata.name).toBe('CSV 动态折线图');
  expect(scene.elements.find(element => element.id === 'axis-x')).toMatchObject({ type: 'line' });
  expect(scene.elements.filter(element => element.type === 'line' && element.id.startsWith('segment-'))).toHaveLength(5);
  expect(scene.animation.filter(binding => binding.channels.includes('pathProgress'))).toHaveLength(5);
  expect(validateScene(scene)).toMatchObject({ valid: true, errors: [] });
});

test('composes ranking CSV as left-to-right ranking bars', () => {
  const scene = composeRankingBarChart(parseCsv('排名,销量\n防晒,86\n粉底液,74\n面霜,71\n精华,67\n散粉,62\n口红,58\n卸妆,55'), 9);
  expect(scene.metadata.name).toBe('CSV 动态排名条形图');
  expect(scene.elements.filter(element => element.type === 'rectangle' && element.id.startsWith('rank-bar-'))).toHaveLength(7);
  expect(scene.animation.filter(binding => binding.channels.includes('growX'))).toHaveLength(7);
  expect(validateScene(scene)).toMatchObject({ valid: true, errors: [] });
});
