import { describe, expect, it } from 'vitest';
import { findFieldPosition } from '@/lib/field-auto-placement';

describe('click field placement', () => {
  it('places seven mixed-size fields without overlap and inside the page', () => {
    const occupied: { left: number; top: number; width: number; height: number }[] = [];
    for (const width of [150, 80, 200, 220, 120, 180, 20]) {
      const rect = findFieldPosition({ width: 612, height: 792 }, { width, height: 50 }, occupied);
      expect(rect).not.toBeNull();
      if (!rect) throw new Error('Missing placement');
      expect(rect.left + rect.width).toBeLessThanOrEqual(588);
      expect(rect.top + rect.height).toBeLessThanOrEqual(768);
      for (const previous of occupied)
        expect(
          rect.left >= previous.left + previous.width ||
            rect.top >= previous.top + previous.height ||
            rect.left + rect.width <= previous.left ||
            rect.top + rect.height <= previous.top,
        ).toBe(true);
      occupied.push(rect);
    }
  });
  it('refuses full pages, oversized fields, and invalid dimensions', () => {
    const page = { width: 100, height: 100 };
    expect(findFieldPosition(page, { width: 60, height: 20 }, [])).toBeNull();
    expect(
      findFieldPosition(page, { width: 20, height: 20 }, [{ left: 24, top: 24, width: 52, height: 52 }]),
    ).toBeNull();
    expect(findFieldPosition(page, { width: NaN, height: 20 }, [])).toBeNull();
  });
});
