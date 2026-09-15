import { describe, expect, it } from 'vitest';
import { shouldAutoAdvanceAfterCompletion, sortFieldsInReadingOrder } from '../lib/signing-field-navigation';

describe('guided signing field order', () => {
  it('walks pages top-to-bottom and left-to-right', () => {
    const fields = [
      { id: 'page-2', pageIndex: 1, boundingBox: { top: 5, left: 5 } },
      { id: 'bottom', pageIndex: 0, boundingBox: { top: 500, left: 10 } },
      { id: 'top-right', pageIndex: 0, boundingBox: { top: 20, left: 200 } },
      { id: 'top-left', pageIndex: 0, boundingBox: { top: 20, left: 10 } },
    ];

    expect(sortFieldsInReadingOrder(fields).map(({ id }) => id)).toEqual(['top-left', 'top-right', 'bottom', 'page-2']);
    expect(fields.map(({ id }) => id)).toEqual(['page-2', 'bottom', 'top-right', 'top-left']);
  });

  it('automatically advances after one-click fields but not while typing text', () => {
    expect(shouldAutoAdvanceAfterCompletion('signature')).toBe(true);
    expect(shouldAutoAdvanceAfterCompletion('initials')).toBe(true);
    expect(shouldAutoAdvanceAfterCompletion('checkbox')).toBe(true);
    expect(shouldAutoAdvanceAfterCompletion('text')).toBe(false);
    expect(shouldAutoAdvanceAfterCompletion('date')).toBe(false);
  });
});
