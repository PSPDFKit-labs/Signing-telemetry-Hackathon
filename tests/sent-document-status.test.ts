import { describe, expect, it } from 'vitest';
import { sentDocumentStatus } from '@/lib/sent-document-status';

describe('sent document lifecycle presentation', () => {
  it('never infers completion from signed counts', () => {
    expect(sentDocumentStatus('IN_PROGRESS', null, '2', '2')).toEqual({
      pill: 'pending', progress: 'Finalization pending', canCancel: false,
    });
  });
  it('handles string-valued zero counts and drafts with recipients', () => {
    for (const count of ['0', '1']) {
      expect(sentDocumentStatus('DRAFT', null, count, '0')).toEqual({
        pill: 'draft', progress: null, canCancel: false,
      });
    }
  });
  it('uses signer-only progress and leaves partial requests cancellable', () => {
    expect(sentDocumentStatus('IN_PROGRESS', null, 2, 1)).toEqual({
      pill: 'pending', progress: '1/2 Signed', canCancel: true,
    });
  });
  it('preserves completed wet returns without electronic signers', () => {
    expect(sentDocumentStatus('COMPLETED', new Date(0), '0', '0').pill).toBe('signed');
  });
  it.each([['DECLINED', 'declined'], ['CANCELLED', 'cancelled'], ['AWAITING_WET_SIGNATURE', 'wet']])(
    'preserves stored %s', (status, pill) => {
      expect(sentDocumentStatus(status, null, 1, 1).pill).toBe(pill);
    },
  );
  it('does not treat expired or unknown records as pending', () => {
    expect(sentDocumentStatus('PENDING', new Date(0), 1, 0).pill).toBe('expired');
    expect(sentDocumentStatus(null, null, 0, 0).pill).toBe('unknown');
  });
});
