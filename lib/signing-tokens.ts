import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const TOKEN_HASH_PREFIX = 'sha256:';

export interface SigningTokenPair {
  rawToken: string;
  storedToken: string;
}

export function hashSigningToken(rawToken: string): string {
  return `${TOKEN_HASH_PREFIX}${createHash('sha256').update(rawToken, 'utf8').digest('hex')}`;
}

export function createSigningToken(): SigningTokenPair {
  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
  return { rawToken, storedToken: hashSigningToken(rawToken) };
}

export function signingTokenMatches(storedToken: string | null, rawToken: string): boolean {
  if (!storedToken || !rawToken) return false;

  // Existing links created before token hashing remain usable until they are
  // rotated by Send or Resend. All newly issued tokens use the prefixed hash.
  const candidate = storedToken.startsWith(TOKEN_HASH_PREFIX) ? hashSigningToken(rawToken) : rawToken;
  const storedBytes = Buffer.from(storedToken, 'utf8');
  const candidateBytes = Buffer.from(candidate, 'utf8');
  return storedBytes.length === candidateBytes.length && timingSafeEqual(storedBytes, candidateBytes);
}

export function tokenLookupCandidates(rawToken: string): string[] {
  return [hashSigningToken(rawToken), rawToken];
}
