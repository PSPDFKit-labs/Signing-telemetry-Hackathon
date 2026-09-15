import { expect, it } from 'vitest';
import { normalizeViewerJson } from '@/lib/normalize-viewer-json';

it('normalizes legacy empty and populated value maps without mutating stored data', () => {
  expect(normalizeViewerJson({ formFieldValues: {} }).formFieldValues).toEqual([]);
  const original = { formFieldValues: { name: 'TEST', checkbox: ['Yes'] } };
  expect(normalizeViewerJson(original).formFieldValues).toEqual([
    { v: 1, type: 'pspdfkit/form-field-value', name: 'name', value: 'TEST' },
    { v: 1, type: 'pspdfkit/form-field-value', name: 'checkbox', value: ['Yes'] },
  ]);
  expect(original.formFieldValues.name).toBe('TEST');
});

it('upgrades older array-form snapshots and preserves omitted field values', () => {
  const snapshot = { formFieldValues: [{ name: 'text', value: 'TEST' }] };
  expect(normalizeViewerJson(snapshot).formFieldValues).toEqual([
    { v: 1, type: 'pspdfkit/form-field-value', name: 'text', value: 'TEST' },
  ]);
  expect(normalizeViewerJson({ annotations: [] })).toEqual({ annotations: [] });
});
