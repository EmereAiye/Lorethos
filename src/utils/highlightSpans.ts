import type { TextHighlight } from '../types';

export interface ParagraphTextSegment {
  text: string;
  highlight?: TextHighlight;
}

export function resolveParagraphHighlightSegments(
  paragraphText: string,
  paragraphHighlights: TextHighlight[]
): ParagraphTextSegment[] {
  const spanHighlights = paragraphHighlights
    .filter(
      (h): h is TextHighlight & { startOffset: number; endOffset: number } =>
        typeof h.startOffset === 'number' &&
        typeof h.endOffset === 'number' &&
        Number.isFinite(h.startOffset) &&
        Number.isFinite(h.endOffset) &&
        h.startOffset >= 0 &&
        h.endOffset > h.startOffset &&
        h.startOffset < paragraphText.length
    )
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);

  if (spanHighlights.length === 0) {
    return [{ text: paragraphText }];
  }

  const segments: ParagraphTextSegment[] = [];
  let cursor = 0;

  for (const hl of spanHighlights) {
    const start = Math.max(cursor, Math.min(paragraphText.length, hl.startOffset));
    const end = Math.max(start, Math.min(paragraphText.length, hl.endOffset));
    if (end <= start) continue;

    if (start > cursor) {
      segments.push({ text: paragraphText.slice(cursor, start) });
    }
    segments.push({
      text: paragraphText.slice(start, end),
      highlight: hl,
    });
    cursor = end;
  }

  if (cursor < paragraphText.length) {
    segments.push({ text: paragraphText.slice(cursor) });
  }

  return segments;
}

export function computeTrimmedSelectionOffsets(
  fullParagraphText: string,
  rawStart: number,
  rawEnd: number
): { startOffset: number; endOffset: number; selectedText: string } | null {
  const clampedStart = Math.max(0, Math.min(fullParagraphText.length, Math.min(rawStart, rawEnd)));
  const clampedEnd = Math.max(0, Math.min(fullParagraphText.length, Math.max(rawStart, rawEnd)));
  const rawSlice = fullParagraphText.slice(clampedStart, clampedEnd);

  const leadingTrim = rawSlice.length - rawSlice.trimStart().length;
  const trailingTrim = rawSlice.length - rawSlice.trimEnd().length;
  const startOffset = clampedStart + leadingTrim;
  const endOffset = clampedEnd - trailingTrim;

  if (endOffset - startOffset < 2) {
    return null;
  }

  const selectedText = fullParagraphText.slice(startOffset, endOffset);
  if (!selectedText.trim()) {
    return null;
  }

  return {
    startOffset,
    endOffset,
    selectedText,
  };
}

export function measureSelectionInParagraphElement(
  paragraphEl: HTMLElement,
  range: Range
): { startOffset: number; endOffset: number; selectedText: string } | null {
  if (!paragraphEl.contains(range.startContainer) || !paragraphEl.contains(range.endContainer)) {
    return null;
  }

  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT);
  let totalChars = 0;
  let startOffset: number | null = null;
  let endOffset: number | null = null;
  let node: Node | null = walker.nextNode();

  while (node) {
    const len = node.textContent?.length ?? 0;
    if (node === range.startContainer) {
      startOffset = totalChars + Math.min(len, Math.max(0, range.startOffset));
    }
    if (node === range.endContainer) {
      endOffset = totalChars + Math.min(len, Math.max(0, range.endOffset));
    }
    totalChars += len;
    node = walker.nextNode();
  }

  if (startOffset === null || endOffset === null) {
    return null;
  }

  const fullText = paragraphEl.textContent || '';
  return computeTrimmedSelectionOffsets(fullText, startOffset, endOffset);
}
