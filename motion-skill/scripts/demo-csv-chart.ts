import { writeFile } from 'node:fs/promises';
import { composeBarChart } from '../src/data/chart';
import { parseCsv } from '../src/data/csv';

const scene = composeBarChart(parseCsv('品类,销量\n护肤,42\n彩妆,31\n香水,18\n洗护,26'), 31);
await writeFile('/tmp/motion-csv-chart.json', `${JSON.stringify(scene)}\n`);
