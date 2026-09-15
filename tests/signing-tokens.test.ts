import { describe, expect, it } from 'vitest';
import {
  createSigningToken,
  hashSigningToken,
  signingTokenMatches,
  tokenLookupCandidates,
} from '../lib/signing-tokens';

describe('signing tokens', () => {
  it('stores only a one-way hash of a high-entropy token', () => {
    const token = createSigningToken();
    expect(token.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.storedToken).toBe(hashSigningToken(token.rawToken));
    expect(token.storedToken).not.toContain(token.rawToken);
  });

  it('compares hashed tokens and supports legacy plaintext during rotation', () => {
    const raw = 'legacy-token';
    expect(signingTokenMatches(hashSigningToken(raw), raw)).toBe(true);
    expect(signingTokenMatches(hashSigningToken(raw), 'wrong')).toBe(false);
    expect(signingTokenMatches(raw, raw)).toBe(true);
    expect(tokenLookupCandidates(raw)).toEqual([hashSigningToken(raw), raw]);
  });
});
