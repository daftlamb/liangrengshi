import { writeFile } from 'node:fs/promises';
import { composeDonutChart } from '../src/data/chart';
import { parseCsv } from '../src/data/csv';

const scene = composeDonutChart(parseCsv('渠道,占比\n小红书,36\n抖音,28\n天猫,21\n线下,15'), 41);
await writeFile('/tmp/motion-donut-chart.json', `${JSON.stringify(scene)}\n`);
