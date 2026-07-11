import type { Scene } from '../model/schema';
import { analyzeOpinion } from './compose';

export function composeDiagramCard(input: { text: string; seed: number }): Scene {
  const analysis = analyzeOpinion(input.text);
  const fragments = analysis.text
    .split(/(?:不是|而是|不一定|让人|导致|因此|的|，|。)/u)
    .map(fragment => fragment.replace(/^(?:真正有|真正的|一个)/u, '').trim())
    .filter(fragment => /\p{Script=Han}/u.test(fragment));
  const [left = fragments[0] ?? '观点', right = fragments.at(-1) ?? '结论'] = analysis.emphasis.length ? analysis.emphasis : [fragments[0], fragments.at(-1)];
  const relationLabel = analysis.relation === 'contrast' ? 'NOT → BUT' : analysis.relation.toUpperCase();
  return {
    metadata: { schemaVersion: 1, revision: 0, seed: input.seed, name: `观点图解卡 · ${analysis.relation}` },
    composition: { width: 900, height: 1200, background: '#F3F1EA', duration: 5, loop: true, style: 'editorial' },
    elements: [
      { id: 'edge', type: 'line', x: 245, y: 590, x2: 655, y2: 590, stroke: '#1747FF', strokeWidth: 4 },
      { id: 'node-a', type: 'circle', x: 245, y: 590, radius: 88, fill: '#111111' },
      { id: 'node-b', type: 'circle', x: 655, y: 590, radius: 104, fill: '#1747FF' },
      { id: 'eyebrow', type: 'text', text: `RELATION / ${relationLabel}`, x: 225, y: 140, fill: '#111111', fontFamily: 'Inter Motion', fontSize: 24 },
      { id: 'statement', type: 'text', text: analysis.text, x: 450, y: 270, fill: '#111111', fontFamily: 'PingFang SC', fontSize: 48 },
      { id: 'node-a-label', type: 'text', text: left, x: 245, y: 604, fill: '#F3F1EA', fontFamily: 'PingFang SC', fontSize: 30 },
      { id: 'node-b-label', type: 'text', text: right, x: 655, y: 604, fill: '#F3F1EA', fontFamily: 'PingFang SC', fontSize: 32 },
      { id: 'caption', type: 'text', text: '关系在动态中成立', x: 255, y: 1030, fill: '#1747FF', fontFamily: 'PingFang SC', fontSize: 28 },
    ],
    generators: [],
    behaviors: [
      { id: 'node-pulse', type: 'wave', waveform: 'sine', amplitude: 14, frequency: 0.18, phase: 0 },
    ],
    falloffs: [],
    animation: [
      { id: 'source-response', elementId: 'node-a', behaviorId: 'node-pulse', falloffIds: [], channels: ['scale'], role: 'primary' },
      { id: 'conclusion-response', elementId: 'node-b', behaviorId: 'node-pulse', falloffIds: [], channels: ['scale'], role: 'supporting' },
    ],
  };
}
