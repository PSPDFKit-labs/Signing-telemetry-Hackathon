import { describe, expect, it } from 'vitest';
import { createSigningEmbedMessage, parentOriginFromReferrer } from '@/lib/embed-contract';

describe('signing embed contract', () => {
  it('supports loopback evaluation without accepting insecure remote origins', () => {
    expect(parentOriginFromReferrer('http://127.0.0.1:3000/documents/42')).toBe('http://127.0.0.1:3000');
    expect(parentOriginFromReferrer('http://[::1]:3000/documents/42')).toBe('http://[::1]:3000');
    expect(parentOriginFromReferrer('http://resident.example/documents/42')).toBeNull();
    expect(parentOriginFromReferrer('ftp://localhost/documents/42')).toBeNull();
    expect(parentOriginFromReferrer('https://user:password@resident.example/documents/42')).toBeNull();
  });
  it('uses the exact parent origin from an HTTPS referrer', () => {
    expect(parentOriginFromReferrer('https://resident.example/app/lease/42')).toBe('https://resident.example');
    expect(parentOriginFromReferrer('javascript:alert(1)')).toBeNull();
  });

  it('creates versioned lifecycle messages without exposing signing tokens', () => {
    expect(createSigningEmbedMessage('completed', 'doc-42', { allSigned: true })).toEqual({
      source: 'nutrient-sign',
      version: 1,
      type: 'completed',
      documentId: 'doc-42',
      detail: { allSigned: true },
    });
  });
});
