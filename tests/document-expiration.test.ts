import { describe, expect, it } from 'vitest';
import { isDocumentExpired } from '../lib/document-expiration';

describe('document expiration', () => {
  it('keeps a document valid through the end of its expiry day', () => {
    const expiry = new Date(2026, 8, 7);
    expect(isDocumentExpired(expiry, new Date(2026, 8, 7, 23, 59, 59, 999))).toBe(false);
    expect(isDocumentExpired(expiry, new Date(2026, 8, 8))).toBe(true);
  });
});
