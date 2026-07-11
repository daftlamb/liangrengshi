export function splitGraphemes(value: string, segmenter: Intl.Segmenter | null = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null): string[] {
  if (segmenter) return Array.from(segmenter.segment(value), ({ segment }) => segment);
  const result: string[] = [];
  for (const character of value) {
    if (/^\p{Mark}$/u.test(character) || /^[\uFE0E\uFE0F]$/u.test(character) || /^\p{Emoji_Modifier}$/u.test(character) || result.at(-1)?.endsWith('\u200d')) result[result.length - 1] += character;
    else if (character === '\u200d' && result.length) result[result.length - 1] += character;
    else if (/^\p{Regional_Indicator}$/u.test(character) && /^\p{Regional_Indicator}$/u.test(result.at(-1) ?? '')) result[result.length - 1] += character;
    else result.push(character);
  }
  return result;
}
