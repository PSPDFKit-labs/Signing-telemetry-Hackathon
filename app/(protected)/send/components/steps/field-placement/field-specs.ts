export type PlaceableFieldType = 'signature' | 'initials' | 'name' | 'email' | 'date' | 'text' | 'checkbox';

export interface FieldSpec {
  type: PlaceableFieldType;
  label: string;
  width: number;
  height: number;
  kind: 'signature' | 'data' | 'choice';
  placeholder?: string;
  prefill?: 'name' | 'email';
}

export const FIELD_SPECS: readonly FieldSpec[] = [
  { type: 'signature', label: 'Signature', width: 150, height: 50, kind: 'signature' },
  { type: 'initials', label: 'Initials', width: 80, height: 40, kind: 'signature' },
  { type: 'name', label: 'Full name', width: 160, height: 30, kind: 'data', prefill: 'name' },
  { type: 'email', label: 'Email', width: 190, height: 30, kind: 'data', prefill: 'email' },
  { type: 'date', label: 'Date signed', width: 120, height: 30, kind: 'data', placeholder: 'mm/dd/yyyy' },
  { type: 'text', label: 'Text', width: 160, height: 30, kind: 'data', placeholder: 'Text' },
  { type: 'checkbox', label: 'Checkbox', width: 24, height: 24, kind: 'choice' },
] as const;

const FIELD_SPEC_BY_TYPE = new Map(FIELD_SPECS.map((spec) => [spec.type, spec]));

export function getFieldSpec(type: string): FieldSpec | undefined {
  return FIELD_SPEC_BY_TYPE.get(type as PlaceableFieldType);
}

export function isPlaceableFieldType(type: string): type is PlaceableFieldType {
  return FIELD_SPEC_BY_TYPE.has(type as PlaceableFieldType);
}

export function getFieldPrefill(type: string, recipient?: { name?: string; email?: string }): string {
  const spec = getFieldSpec(type);
  if (spec?.prefill === 'name') return recipient?.name ?? '';
  if (spec?.prefill === 'email') return recipient?.email ?? '';
  return '';
}
