import { describe, expect, it } from 'vitest';
import { signatureStorageKeys } from '../lib/signature-storage';

describe('signature storage isolation', () => {
  it('creates different tab-scoped keys for every document and participant', () => {
    const first = signatureStorageKeys('document-1', 'participant-1');
    expect(first).not.toEqual(signatureStorageKeys('document-1', 'participant-2'));
    expect(first).not.toEqual(signatureStorageKeys('document-2', 'participant-1'));
    expect(first.signatures).toContain('document-1:participant-1');
    expect(first.attachments).toContain('document-1:participant-1');
  });
});
