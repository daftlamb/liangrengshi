import type { Scene } from '../model/schema';
import { centeredPair, leftTextBlock } from '../layout/anchors';
import { relationEdge } from '../layout/relations';
import { fitTextInCircle, leftTextLine } from '../layout/text';
import { analyzeOpinion } from './compose';

const titleLines = (text: string) => text.length > 14 ? `${text.slice(0, 10)}\n${text.slice(10)}` : text;
const arrowPoints = [{ x: 0, y: 0 }, { x: -20, y: -12 }, { x: -20, y: 12 }];

export const diagramDirectionValues = {
  composition: ['auto', 'causal', 'contrast', 'converge', 'system', 'timeline'] as const,
  palette: ['default', 'mono', 'signal-red', 'electric-blue', 'warm-paper'] as const,
  motion: ['calm', 'natural', 'pronounced', 'quick', 'still-first'] as const,
  typography: ['sans', 'editorial-serif', 'mixed', 'brand'] as const,
  background: ['none', 'dot-matrix', 'grid'] as const,
};

export type DiagramDirection = { [K in keyof typeof diagramDirectionValues]: (typeof diagramDirectionValues)[K][number] };
export type DiagramDirectionInput = Partial<DiagramDirection>;

const paletteFor = (palette: DiagramDirection['palette']) => {
  if (palette === 'mono') return { background: '#FFFFFF', ink: '#111111', accent: '#111111' };
  if (palette === 'signal-red') return { background: '#F3F1EA', ink: '#111111', accent: '#E52521' };
  if (palette === 'warm-paper') return { background: '#E9E0D2', ink: '#221D18', accent: '#B24A25' };
  return { background: '#F3F1EA', ink: '#111111', accent: '#1747FF' };
};
const motionFor = (motion: DiagramDirection['motion']) => {
  if (motion === 'calm') return { amplitude: 0.035, frequency: 0.12 };
  if (motion === 'pronounced') return { amplitude: 0.13, frequency: 0.32 };
  if (motion === 'quick') return { amplitude: 0.08, frequency: 0.48 };
  if (motion === 'still-first') return { amplitude: 0.02, frequency: 0.1 };
  return { amplitude: 0.07, frequency: 0.16 };
};
const typefaceFor = (typography: DiagramDirection['typography']) => typography === 'editorial-serif' ? 'Songti SC' : 'PingFang SC';

export function resolveDiagramDirection(input: DiagramDirectionInput = {}): DiagramDirection {
  return { composition: input.composition ?? 'auto', palette: input.palette ?? 'default', motion: input.motion ?? 'natural', typography: input.typography ?? 'sans', background: input.background ?? 'none' };
}

export function composeDiagramCard(input: { text: string; seed: number; direction?: DiagramDirectionInput }): Scene {
  const analysis = analyzeOpinion(input.text);
  const direction = resolveDiagramDirection(input.direction);
  const relation = direction.composition === 'auto' ? analysis.relation : direction.composition === 'causal' ? 'propagate' : direction.composition;
  const colors = paletteFor(direction.palette);
  const fontFamily = typefaceFor(direction.typography);
  const motion = motionFor(direction.motion);
  const cause = relation === 'propagate' ? input.text.split('导致')[0]?.split(/[和、及]/u).filter(Boolean).slice(0, 2) ?? [] : [];
  const effect = relation === 'propagate' ? input.text.split('导致')[1] : undefined;
  const title = leftTextBlock(titleLines(analysis.text), { left: 88, top: 180, fontSize: 48, lineHeight: 58 });
  const eyebrow = leftTextLine(`RELATION / ${relation.toUpperCase()}`, { left: 88, y: 105, fontSize: 24 });
  const caption = leftTextLine('外部条件 → 消费结果', { left: 88, y: 1080, fontSize: 28 });
  const backgroundElements: Scene['elements'] = direction.background === 'dot-matrix'
    ? [{ id: 'background-dot', type: 'circle', x: 54, y: 72, radius: 3, fill: '#C9C7C0' }]
    : direction.background === 'grid'
      ? [
        ...Array.from({ length: 12 }, (_, index) => ({ id: `background-grid-v-${index}`, type: 'line' as const, x: 54 + index * 72, y: 48, x2: 54 + index * 72, y2: 1152, stroke: '#D4D1C8', strokeWidth: 1 })),
        ...Array.from({ length: 13 }, (_, index) => ({ id: `background-grid-h-${index}`, type: 'line' as const, x: 54, y: 72 + index * 84, x2: 846, y2: 72 + index * 84, stroke: '#D4D1C8', strokeWidth: 1 })),
      ]
      : [];
  const elements: Scene['elements'] = [
    ...backgroundElements,
    ...title.map((line, index) => ({ id: `title-${index}`, type: 'text' as const, text: line.text, x: 88, y: line.y, textAlign: 'left' as const, fill: colors.ink, fontFamily, fontSize: 48 })),
    { id: 'eyebrow', type: 'text', text: eyebrow.text, x: 88, y: eyebrow.y, textAlign: 'left' as const, fill: colors.ink, fontFamily: 'Inter Motion', fontSize: 24 },
    { id: 'caption', type: 'text', text: caption.text, x: 88, y: caption.y, textAlign: 'left' as const, fill: colors.accent, fontFamily, fontSize: 28 },
  ];
  const animation: Scene['animation'] = [];

  if (relation === 'timeline') {
    const stages = input.text.split(/[、，,→]/u).map(part => part.replace(/构成.*$/u, '').trim()).filter(Boolean).slice(0, 3);
    const labels = [...stages, '完成', '完成'].slice(0, 3);
    const xs = [220, 450, 680];
    labels.forEach((label, index) => elements.push(
      { id: `timeline-node-${index}`, type: 'circle', x: xs[index]!, y: 620, radius: index === 1 ? 82 : 68, fill: index === 1 ? colors.accent : colors.ink },
      { id: `timeline-label-${index}`, type: 'text', text: label, x: xs[index]!, y: 632, fill: colors.background, fontFamily, fontSize: 28 },
    ));
    elements.push(
      { id: 'timeline-edge-0', type: 'line', x: 288, y: 620, x2: 368, y2: 620, stroke: colors.accent, strokeWidth: 4 },
      { id: 'timeline-edge-1', type: 'line', x: 532, y: 620, x2: 612, y2: 620, stroke: colors.accent, strokeWidth: 4 },
    );
    animation.push({ id: 'timeline-response', elementId: 'timeline-node-1', behaviorId: 'result-pulse', falloffIds: [], channels: ['scale'], role: 'primary' });
  } else if (cause.length === 2 && effect) {
    const sourceA = { x: 280, y: 490, radius: 120 };
    const sourceB = { x: 620, y: 490, radius: 120 };
    const result = { x: 450, y: 875, radius: 132 };
    const sourceALabel = fitTextInCircle(cause[0]!, { radius: sourceA.radius, fontSize: 38, inset: 28, lineHeight: 42 });
    const sourceBLabel = fitTextInCircle(cause[1]!, { radius: sourceB.radius, fontSize: 38, inset: 28, lineHeight: 42 });
    const resultLabel = fitTextInCircle(effect, { radius: result.radius, fontSize: 34, inset: 44, lineHeight: 38, preferredBreakBefore: ['销量', '增长', '降低', '提升', '下降'] });
    const leftEdge = relationEdge({ from: sourceA, to: result, clearance: 14 });
    const rightEdge = relationEdge({ from: sourceB, to: result, clearance: 14 });
    elements.push(
      { id: 'node-a', type: 'circle', ...sourceA, fill: colors.ink },
      { id: 'node-b', type: 'circle', ...sourceB, fill: colors.accent },
      { id: 'result-node', type: 'circle', ...result, fill: colors.ink },
      { id: 'node-a-label', type: 'text', text: sourceALabel.text, x: sourceA.x, y: sourceA.y + sourceALabel.baselineOffset, fill: colors.background, fontFamily, fontSize: 38, lineHeight: sourceALabel.lineHeight },
      { id: 'node-b-label', type: 'text', text: sourceBLabel.text, x: sourceB.x, y: sourceB.y + sourceBLabel.baselineOffset, fill: colors.background, fontFamily, fontSize: 38, lineHeight: sourceBLabel.lineHeight },
      { id: 'result-label', type: 'text', text: resultLabel.text, x: result.x, y: result.y + resultLabel.baselineOffset, fill: colors.background, fontFamily, fontSize: 34, lineHeight: resultLabel.lineHeight },
      { id: 'cause-a-edge', type: 'line', x: leftEdge.start.x, y: leftEdge.start.y, x2: leftEdge.end.x, y2: leftEdge.end.y, stroke: colors.accent, strokeWidth: 5 },
      { id: 'cause-b-edge', type: 'line', x: rightEdge.start.x, y: rightEdge.start.y, x2: rightEdge.end.x, y2: rightEdge.end.y, stroke: colors.accent, strokeWidth: 5 },
      { id: 'cause-a-arrow', type: 'polygon', x: leftEdge.arrow.x, y: leftEdge.arrow.y, rotation: leftEdge.arrow.rotation, points: arrowPoints, fill: colors.accent },
      { id: 'cause-b-arrow', type: 'polygon', x: rightEdge.arrow.x, y: rightEdge.arrow.y, rotation: rightEdge.arrow.rotation, points: arrowPoints, fill: colors.accent },
    );
    animation.push(
      { id: 'source-a-response', elementId: 'node-a', behaviorId: 'node-pulse', falloffIds: [], channels: ['scale'], role: 'supporting' },
      { id: 'source-b-response', elementId: 'node-b', behaviorId: 'node-pulse', falloffIds: [], channels: ['scale'], role: 'supporting' },
      { id: 'result-response', elementId: 'result-node', behaviorId: 'result-pulse', falloffIds: [], channels: ['scale'], role: 'primary' },
    );
  } else {
    const focusParts = analysis.text
      .split(/(?:不是|而是|不一定|让人|导致|因此|的|，|。)/u)
      .map(part => part.replace(/^(?:真正有|真正的|一个)/u, '').trim())
      .filter(part => /\p{Script=Han}/u.test(part));
    const [left = '观点', right = '结论'] = analysis.emphasis.length ? analysis.emphasis : [focusParts[0], focusParts.at(-1)];
    const pair = centeredPair({ canvasWidth: 900, leftRadius: 88, rightRadius: 104, gap: 140, y: 620 });
    const edge = relationEdge({ from: { ...pair.left, radius: 88 }, to: { ...pair.right, radius: 104 }, clearance: 14 });
    elements.push(
      { id: 'node-a', type: 'circle', ...pair.left, radius: 88, fill: colors.ink },
      { id: 'node-b', type: 'circle', ...pair.right, radius: 104, fill: colors.accent },
      { id: 'node-a-label', type: 'text', text: left, x: pair.left.x, y: pair.left.y + 12, fill: colors.background, fontFamily, fontSize: 30 },
      { id: 'node-b-label', type: 'text', text: right, x: pair.right.x, y: pair.right.y + 12, fill: colors.background, fontFamily, fontSize: 32 },
      { id: 'relation-edge', type: 'line', x: edge.start.x, y: edge.start.y, x2: edge.end.x, y2: edge.end.y, stroke: colors.accent, strokeWidth: 4 },
      { id: 'relation-arrow', type: 'polygon', x: edge.arrow.x, y: edge.arrow.y, rotation: edge.arrow.rotation, points: arrowPoints, fill: colors.accent },
    );
    animation.push(
      { id: 'source-response', elementId: 'node-a', behaviorId: 'node-pulse', falloffIds: [], channels: ['scale'], role: 'supporting' },
      { id: 'conclusion-response', elementId: 'node-b', behaviorId: 'result-pulse', falloffIds: [], channels: ['scale'], role: 'primary' },
    );
  }

  return {
    metadata: { schemaVersion: 1, revision: 0, seed: input.seed, name: `观点图解卡 · ${relation}` },
    composition: { width: 900, height: 1200, background: colors.background, duration: 5, loop: true, style: 'editorial' },
    elements,
    generators: direction.background === 'dot-matrix' ? [{ id: 'background-dots', type: 'grid', elementId: 'background-dot', columns: 12, rows: 16, gapX: 72, gapY: 72 }] : [],
    behaviors: [
      { id: 'node-pulse', type: 'wave', waveform: 'sine', amplitude: motion.amplitude, frequency: motion.frequency, phase: 0 },
      { id: 'result-pulse', type: 'wave', waveform: 'sine', amplitude: motion.amplitude + 0.02, frequency: motion.frequency, phase: 0.65 },
    ],
    falloffs: [],
    animation,
  };
}
