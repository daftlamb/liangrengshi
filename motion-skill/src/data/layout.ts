export interface DonutChartLayout {
  chart: { x: number; y: number; innerRadius: number; outerRadius: number; totalLabelY: number; totalValueY: number };
  legend: { columns: 1 | 2; rowsPerColumn: number; startY: number; gap: number; fontSize: number; swatchSize: number };
}

export function donutChartLayout(itemCount: number): DonutChartLayout {
  if (itemCount > 6) return {
    chart: { x: 450, y: 488, innerRadius: 116, outerRadius: 214, totalLabelY: 478, totalValueY: 533 },
    legend: { columns: 2, rowsPerColumn: Math.ceil(itemCount / 2), startY: 812, gap: 48, fontSize: 22, swatchSize: 22 },
  };
  return {
    chart: { x: 450, y: 540, innerRadius: 150, outerRadius: 260, totalLabelY: 530, totalValueY: 585 },
    legend: { columns: 1, rowsPerColumn: itemCount, startY: 840, gap: 54, fontSize: 26, swatchSize: 26 },
  };
}
