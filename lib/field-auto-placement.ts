interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Finds a page-bounded, non-overlapping location; returns null when the page is full. */
export function findFieldPosition(
  page: { width: number; height: number },
  size: { width: number; height: number },
  occupied: Rect[],
): Rect | null {
  if (![page.width, page.height, size.width, size.height].every((value) => Number.isFinite(value) && value > 0))
    return null;
  const margin = 24;
  const gap = 12;
  const rects = occupied.filter(
    (rect) =>
      [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0,
  );
  const xs = [...new Set([margin, ...rects.map((rect) => rect.left + rect.width + gap)])].sort((a, b) => a - b);
  const ys = [...new Set([margin, ...rects.map((rect) => rect.top + rect.height + gap)])].sort((a, b) => a - b);
  for (const top of ys)
    for (const left of xs) {
      if (
        left < margin ||
        top < margin ||
        left + size.width > page.width - margin ||
        top + size.height > page.height - margin
      )
        continue;
      const intersects = rects.some(
        (rect) =>
          left < rect.left + rect.width + gap &&
          left + size.width + gap > rect.left &&
          top < rect.top + rect.height + gap &&
          top + size.height + gap > rect.top,
      );
      if (!intersects) return { left, top, ...size };
    }
  return null;
}
