export function textRunWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((width, character) => {
    if (/\s/u.test(character)) return width + fontSize * 0.35;
    if (/[\p{Script=Han}，。！？、；：]/u.test(character)) return width + fontSize;
    return width + fontSize * 0.56;
  }, 0);
}

export function leftTextLine(text: string, options: { left: number; y: number; fontSize: number }) {
  return { text, x: options.left + textRunWidth(text, options.fontSize) / 2, y: options.y };
}

export function fitTextInCircle(text: string, options: { radius: number; fontSize: number; inset: number; lineHeight: number; preferredBreakBefore?: string[] }) {
  const capacity = Math.max(1, Math.floor((options.radius - options.inset) * 2 / options.fontSize));
  const characters = Array.from(text);
  const preferredIndex = options.preferredBreakBefore
    ?.map(marker => text.indexOf(marker))
    .find(index => index !== undefined && index > 0 && index < characters.length && index <= capacity);
  const lines = preferredIndex === undefined
    ? Array.from({ length: Math.ceil(characters.length / capacity) }, (_, index) => characters.slice(index * capacity, (index + 1) * capacity).join(''))
    : [characters.slice(0, preferredIndex).join(''), characters.slice(preferredIndex).join('')];
  return {
    text: lines.join('\n'),
    lineHeight: options.lineHeight,
    baselineOffset: options.fontSize * 0.34 - (lines.length - 1) * options.lineHeight / 2,
  };
}
