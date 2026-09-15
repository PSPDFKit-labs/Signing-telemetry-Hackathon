import { describe, expect, it } from 'vitest';
import { getSigningFieldType, hasRequiredFieldValue } from '../lib/signing-fields';

describe('signing field values', () => {
  it('recognizes completed text and checkbox values from the viewer', () => {
    expect(hasRequiredFieldValue('Resident One')).toBe(true);
    expect(hasRequiredFieldValue(['Yes'])).toBe(true);
    expect(hasRequiredFieldValue('')).toBe(false);
    expect(hasRequiredFieldValue([])).toBe(false);
    expect(hasRequiredFieldValue(null)).toBe(false);
    expect(hasRequiredFieldValue('Off')).toBe(false);
  });

  it('uses canonical custom data before the field-name fallback', () => {
    expect(getSigningFieldType('initials', 'signature_1')).toBe('initials');
    expect(getSigningFieldType(undefined, 'checkbox_1')).toBe('checkbox');
  });
});
