import type { Scene } from '../model/schema';

export type OpinionRelation = 'focus' | 'contrast' | 'converge' | 'propagate';
export type MotionPersonality = 'precise' | 'elastic' | 'flowing' | 'magnetic' | 'restless';

export interface OpinionAnalysis {
  text: string;
  relation: OpinionRelation;
  emphasis: string[];
  motion: MotionPersonality;
}

const chineseLength = (text: string) => text.match(/\p{Script=Han}/gu)?.length ?? 0;
const cleanPhrase = (text: string) => {
  const cleaned = text.replace(/[，。！？；：、“”‘’]/gu, '').trim();
  return cleaned.length > 6 ? cleaned.replace(/^(?:进入|形成|成为)/u, '') : cleaned;
};

export function analyzeOpinion(rawText: string): OpinionAnalysis {
  const text = rawText.trim();
  const length = chineseLength(text);
  if (length < 12 || length > 40) throw new Error('观点需包含 12–40 个汉字');

  const contrast = text.match(/不是(.+?)而是(.+)/u);
  if (contrast) {
    return {
      text,
      relation: 'contrast',
      emphasis: [cleanPhrase(contrast[1]!), cleanPhrase(contrast[2]!)].filter(Boolean).slice(0, 2),
      motion: 'magnetic',
    };
  }

  const converge = text.match(/(?:关键(?:在于|是)?|取决于|最终(?:是|在于)?|核心(?:是|在于)?)(.+)/u);
  if (converge) return { text, relation: 'converge', emphasis: [cleanPhrase(converge[1]!)].filter(Boolean), motion: 'magnetic' };

  if (/(?:导致|因此|影响|一旦|传播|扩散)/u.test(text)) {
    const tail = text.split(/导致|因此/u).at(-1) ?? text;
    return { text, relation: 'propagate', emphasis: [cleanPhrase(tail)].filter(Boolean).slice(0, 1), motion: 'flowing' };
  }

  return { text, relation: 'focus', emphasis: [], motion: 'precise' };
}

function wrapOpinion(text: string): string {
  const graphemes = Array.from(text);
  if (graphemes.length <= 14) return text;
  const midpoint = Math.ceil(graphemes.length / 2);
  const candidates = graphemes.map((character, index) => ({ character, index })).filter(({ character }) => /[，；：、]/u.test(character));
  const breakAt = candidates.sort((a, b) => Math.abs(a.index - midpoint) - Math.abs(b.index - midpoint))[0]?.index ?? midpoint;
  return `${graphemes.slice(0, breakAt + 1).join('')}\n${graphemes.slice(breakAt + 1).join('')}`;
}

export function composeOpinionCard(input: { text: string; seed: number }): Scene {
  const analysis = analyzeOpinion(input.text);
  const amplitude = analysis.motion === 'flowing' ? 22 : analysis.motion === 'magnetic' ? 16 : 9;
  return {
    metadata: { schemaVersion: 1, revision: 0, seed: input.seed, name: `现代主义观点卡 · ${analysis.relation}` },
    composition: { width: 900, height: 1200, background: '#F3F1EA', duration: 5, loop: true, style: 'editorial' },
    elements: [
      { id: 'field-dot', type: 'circle', x: 105, y: 235, radius: 4, fill: '#111111', opacity: 0.14 },
      { id: 'signal', type: 'rectangle', x: 88, y: 118, width: 118, height: 12, cornerRadius: 0, fill: '#1747FF' },
      { id: 'label', type: 'text', text: `OPINION / ${analysis.relation.toUpperCase()}`, split: 'none', x: 230, y: 182, fill: '#111111', fontFamily: 'Inter Motion', fontSize: 24 },
      { id: 'statement', type: 'text', text: wrapOpinion(analysis.text), split: 'none', x: 450, y: 570, fill: '#111111', fontFamily: 'PingFang SC', fontSize: 76 },
      { id: 'emphasis', type: 'text', text: analysis.emphasis.join(' / ') || '观点', split: 'none', x: 250, y: 1065, fill: '#1747FF', fontFamily: 'PingFang SC', fontSize: 32 },
    ],
    generators: [
      { id: 'modernist-field', type: 'grid', elementId: 'field-dot', columns: 8, rows: 9, gapX: 98, gapY: 92 },
    ],
    behaviors: [
      { id: 'semantic-wave', type: 'wave', waveform: 'sine', amplitude, frequency: 0.2, phase: 0 },
    ],
    falloffs: [
      { id: 'reading-order', type: 'index', start: 0.2, end: 1, easing: 'easeInOut', invert: false, clamp: [0, 1] },
    ],
    animation: [
      { id: 'statement-breathe', elementId: 'statement', behaviorId: 'semantic-wave', falloffIds: [], channels: ['y'], role: 'primary' },
      { id: 'field-response', elementId: 'field-dot', behaviorId: 'semantic-wave', falloffIds: ['reading-order'], channels: ['y'], role: 'supporting' },
    ],
  };
}
