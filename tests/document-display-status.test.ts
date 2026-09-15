import { describe, expect, it } from 'vitest';
import { documentDisplayStatus } from '@/lib/document-display-status';

describe('document display status', () => {
  const now = new Date('2026-09-09T00:00:00Z');
  const past = new Date('2026-01-01T00:00:00Z');
  it.each([
    ['COMPLETED', 'signed'],
    ['DECLINED', 'declined'],
    ['CANCELLED', 'cancelled'],
    ['DRAFT', 'draft'],
  ])('preserves %s after its original deadline', (status, expected) => {
    expect(documentDisplayStatus(status, past, now)).toBe(expected);
  });
  it.each(['PENDING', 'IN_PROGRESS', 'AWAITING_WET_SIGNATURE'])('expires active %s at its deadline', (status) => {
    expect(documentDisplayStatus(status, now, now)).toBe('expired');
  });
  it('distinguishes waiting for a wet return from electronic signing', () => {
    expect(documentDisplayStatus('AWAITING_WET_SIGNATURE', null, now)).toBe('wet');
    expect(documentDisplayStatus('IN_PROGRESS', null, now)).toBe('pending');
  });
  it('does not invent a pending status for missing or unknown data', () => {
    expect(documentDisplayStatus(null, null, now)).toBe('unknown');
    expect(documentDisplayStatus('UNRECOGNIZED', past, now)).toBe('unknown');
  });
});
