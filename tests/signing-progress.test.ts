import { describe, expect, it } from 'vitest';
import { allRequiredSignaturesRecorded, isSigningOrderComplete } from '../lib/signing-progress';

describe('signing progress', () => {
  it('treats legacy null required flags as required', () => {
    const entries = [{ request: { status: 'PENDING' }, participant: { isRequired: null, signingOrder: 1 } }];
    expect(allRequiredSignaturesRecorded(entries)).toBe(false);
    expect(isSigningOrderComplete(entries, 1)).toBe(false);
  });

  it('allows explicitly optional signers to remain pending', () => {
    const entries = [
      { request: { status: 'SIGNED' }, participant: { isRequired: true, signingOrder: 1 } },
      { request: { status: 'PENDING' }, participant: { isRequired: false, signingOrder: 2 } },
    ];
    expect(allRequiredSignaturesRecorded(entries)).toBe(true);
    expect(isSigningOrderComplete(entries, 2)).toBe(true);
  });
});
