export type DataChartKind = 'bar' | 'donut' | 'line' | 'ranking-bar';
export interface CsvDataset { headers: string[]; rows: Record<string, string>[]; chart: DataChartKind }

export function parseCsv(source: string): CsvDataset {
  const lines = source.trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV 至少需要表头和一行数据');
  const headers = lines[0]!.split(',').map(value => value.trim());
  if (headers.length < 2 || headers.some(header => !header)) throw new Error('CSV 需要至少两列且表头不能为空');
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    if (values.length !== headers.length) throw new Error('CSV 每行列数必须一致');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]! ]));
  });
  const first = headers[0]!;
  const numericHeader = headers.slice(1).find(header => rows.every(row => Number.isFinite(Number(row[header]))));
  if (!numericHeader) throw new Error('CSV 需要至少一列数值');
  const numericValues = rows.map(row => Number(row[numericHeader]));
  const descending = numericValues.every((value, index) => index === 0 || numericValues[index - 1]! >= value);
  const headerText = headers.join(' ');
  const chart: DataChartKind = /日期|时间|月份|年份|季度|date|time|month|year/i.test(first)
    ? 'line'
    : /排名|排行|榜单|rank|top/i.test(headerText) || (rows.length > 6 && descending)
      ? 'ranking-bar'
      : rows.length <= 6 ? 'donut' : 'bar';
  return { headers, rows, chart };
}
