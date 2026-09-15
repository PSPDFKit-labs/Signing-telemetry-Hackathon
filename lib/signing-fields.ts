export const SIGNATURE_FIELD_TYPES = new Set(['signature', 'initial', 'initials']);
export const VALUE_FIELD_TYPES = new Set(['name', 'email', 'date', 'text', 'checkbox']);

export function getSigningFieldType(customType: unknown, fieldName: string): string {
  const value = typeof customType === 'string' ? customType : fieldName.split('_')[0];
  return value.toLowerCase();
}

export function hasRequiredFieldValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRequiredFieldValue);
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 && normalized !== 'off';
  }
  return value === true || (typeof value === 'number' && Number.isFinite(value));
}
