import { describe, expect, it, vi } from 'vitest';
import {
  FIELD_SPECS,
  getFieldPrefill,
  getFieldSpec,
  isPlaceableFieldType,
} from '@/app/(protected)/send/components/steps/field-placement/field-specs';
import { buildFormField } from '@/app/(protected)/send/components/steps/field-placement/utils';

class MockList {
  constructor(public readonly values: unknown[]) {}
}

class MockFormOption {
  constructor(public readonly options: Record<string, unknown>) {}
}

describe('Resident Interface field definitions', () => {
  it('exposes the production field palette transferred from Michael’s POC', () => {
    expect(FIELD_SPECS.map(({ type }) => type)).toEqual([
      'signature',
      'initials',
      'name',
      'email',
      'date',
      'text',
      'checkbox',
    ]);
    expect(getFieldSpec('checkbox')).toMatchObject({ width: 24, height: 24, kind: 'choice' });
    expect(isPlaceableFieldType('digitalSignature')).toBe(false);
  });

  it('prefills verified recipient identity fields only', () => {
    const recipient = { name: 'Resident One', email: 'resident@example.com' };
    expect(getFieldPrefill('name', recipient)).toBe('Resident One');
    expect(getFieldPrefill('email', recipient)).toBe('resident@example.com');
    expect(getFieldPrefill('text', recipient)).toBe('');
  });

  it('creates checkbox fields with a stable checked value', () => {
    const CheckBoxFormField = vi.fn(function (this: any, options: unknown) {
      this.options = options;
    });
    const runtime = {
      FormFields: { CheckBoxFormField },
      FormOption: MockFormOption,
      Immutable: { List: MockList },
    };

    const field = buildFormField(runtime, 'checkbox', 'widget-1', 'checkbox_resident_1');

    expect(CheckBoxFormField).toHaveBeenCalledOnce();
    expect(field.options.annotationIds.values).toEqual(['widget-1']);
    expect(field.options.options.values[0].options).toEqual({ label: 'Yes', value: 'Yes' });
  });
});
