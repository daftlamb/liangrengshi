export interface TextLine { text: string; x: number; y: number }

export function leftTextBlock(text: string, options: { left: number; top: number; fontSize: number; lineHeight: number }): TextLine[] {
  return text.split('\n').map((line, index) => ({
    text: line,
    x: options.left + Array.from(line).length * options.fontSize / 2,
    y: options.top + index * options.lineHeight,
  }));
}

export function centeredPair(options: { canvasWidth: number; leftRadius: number; rightRadius: number; gap: number; y: number }) {
  const width = options.leftRadius * 2 + options.gap + options.rightRadius * 2;
  const leftBound = (options.canvasWidth - width) / 2;
  return {
    left: { x: leftBound + options.leftRadius, y: options.y },
    right: { x: leftBound + options.leftRadius * 2 + options.gap + options.rightRadius, y: options.y },
  };
}
