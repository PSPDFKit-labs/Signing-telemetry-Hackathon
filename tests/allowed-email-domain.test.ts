import { describe, expect, it } from 'vitest';
import { isEmailDomainAllowed } from '../lib/auth/allowed-email-domain';

describe('OAuth email-domain allowlist', () => {
  it('fails closed for absent and malformed identities when configured', () => {
    expect(isEmailDomainAllowed(undefined, 'nutrient.io')).toBe(false);
    expect(isEmailDomainAllowed('not-an-email', 'nutrient.io')).toBe(false);
    expect(isEmailDomainAllowed('@nutrient.io', 'nutrient.io')).toBe(false);
  });

  it('normalizes configured and identity domains without allowing suffix tricks', () => {
    expect(isEmailDomainAllowed('Person@NUTRIENT.IO', ' fileinvite.com, nutrient.io ')).toBe(true);
    expect(isEmailDomainAllowed('person@evilnutrient.io', 'nutrient.io')).toBe(false);
    expect(isEmailDomainAllowed('person@nutrient.io.evil.test', 'nutrient.io')).toBe(false);
  });

  it('allows any valid or absent identity when no allowlist is configured', () => {
    expect(isEmailDomainAllowed('person@example.com', '')).toBe(true);
    expect(isEmailDomainAllowed(undefined, '')).toBe(true);
  });
});
