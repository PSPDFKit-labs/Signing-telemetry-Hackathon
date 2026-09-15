import { describe, expect, it } from 'vitest';
import { describeSendResult } from '@/lib/send-result';

describe('send outcome shown to coordinators', () => {
  it('does not call a saved batch delivered when every email failed', () => {
    const result = describeSendResult({ created: 124, emailsSent: 0, emailsExpected: 124 }, true);
    expect(result.incomplete).toBe(true);
    expect(result.description).toContain('0 of 124');
    expect(result.description).toContain('Resend');
  });
  it('reports partial delivery', () => {
    expect(describeSendResult({ created: 124, emailsSent: 100, emailsExpected: 124 }, true).incomplete).toBe(true);
  });
  it('counts only active signers for sequential routing', () => {
    expect(describeSendResult({ emailsSent: 1, emailsExpected: 1 }, false).incomplete).toBe(false);
  });
  it('does not claim a retry delivered any invitations', () => {
    expect(describeSendResult({ alreadyCreated: true, created: 124 }, true).description).toContain(
      'No new invitations',
    );
  });
  it('does not invent confirmation when delivery counts are absent', () => {
    expect(describeSendResult({}, false).incomplete).toBe(true);
  });
});
