
export interface WordLayout {
  text: string;
  width: number;
  x: number;
  startTime: number; // Normalized 0-1
  endTime: number;   // Normalized 0-1
}

export interface LineLayout {
  words: WordLayout[];
  y: number;
  width: number;
}

export interface TextLayout {
  lines: LineLayout[];
  flattenedWords: WordLayout[];
  totalChars: number;
  fontSize: number;
}

/**
 * Calculates a memoizable text layout and pre-calculates timing metadata.
 */
export function calculateTextLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startY: number,
  fontSize: number,
  lineHeightScale: number = 1.35
): TextLayout {
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  const rawWords = text.split(' ');
  const spaceWidth = ctx.measureText(' ').width;

  const lines: WordLayout[][] = [];
  let currentLine: WordLayout[] = [];
  let currentLineWidth = 0;

  // 1. Build Lines
  rawWords.forEach(wordStr => {
    const wordWidth = ctx.measureText(wordStr).width;
    if (currentLine.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      currentLineWidth = 0;
    }
    
    currentLine.push({ text: wordStr, width: wordWidth, x: 0, startTime: 0, endTime: 0 });
    currentLineWidth += (currentLine.length > 1 ? spaceWidth : 0) + wordWidth;
  });
  if (currentLine.length > 0) lines.push(currentLine);

  // 2. Position Words and Calculate Weights
  const lineHeight = fontSize * lineHeightScale;
  const flattenedWords: WordLayout[] = [];
  
  // Heuristic: commas and periods get more weight (pause time)
  const getWeight = (t: string) => {
    let w = t.length;
    if (t.endsWith(',') || t.endsWith(';')) w += 4;
    if (t.endsWith('.') || t.endsWith('!') || t.endsWith('?')) w += 8;
    return Math.max(1, w);
  };

  const weights = lines.flatMap(l => l.map(w => getWeight(w.text)));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let cumulativeWeight = 0;
  const layoutLines: LineLayout[] = lines.map((line, idx) => {
    const lineWidth = line.reduce((acc, w, i) => acc + w.width + (i > 0 ? spaceWidth : 0), 0);
    let currentX = (maxWidth - lineWidth) / 2;
    
    const positionedWords = line.map((w) => {
      const x = currentX;
      currentX += w.width + spaceWidth;
      
      const weight = getWeight(w.text);
      const startTime = cumulativeWeight / totalWeight;
      cumulativeWeight += weight;
      const endTime = cumulativeWeight / totalWeight;

      const wordWithMeta = { ...w, x, startTime, endTime };
      flattenedWords.push(wordWithMeta);
      return wordWithMeta;
    });

    return {
      words: positionedWords,
      y: startY + (idx * lineHeight),
      width: lineWidth
    };
  });

  return {
    lines: layoutLines,
    flattenedWords,
    totalChars: text.length,
    fontSize
  };
}
