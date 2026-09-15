import { describe, expect, it } from 'vitest';
import { InvalidSigningPayloadError, mergeSignerInstantJson } from '../lib/instant-json-security';

const widget = {
  id: 'widget-1',
  type: 'pspdfkit/widget',
  pageIndex: 0,
  formFieldName: 'signature_1',
  boundingBox: { left: 10, top: 10, width: 100, height: 40 },
  customData: { signerID: 'participant-1', type: 'signature' },
};
const canonical = { annotations: [widget], formFields: [{ name: 'signature_1' }], formFieldValues: {} };

describe('signer InstantJSON merge', () => {
  it('accepts the serialized bbox arrays exported by the real SDK', () => {
    const { boundingBox, ...rest } = widget;
    const exportedWidget = { ...rest, v: 2, bbox: [10, 10, 100, 40] };
    const mark = { id: 'typed-signature', type: 'pspdfkit/image', pageIndex: 0, bbox: [20, 15, 50, 20] };
    const source = { ...canonical, annotations: [exportedWidget] };
    expect(mergeSignerInstantJson(source, { annotations: [mark] }, 'participant-1').annotations).toEqual([
      exportedWidget,
      mark,
    ]);
    for (const bbox of [
      [200, 200, 50, 20],
      [20, 15, -1, 20],
      [20, 15, 50],
      [20, 15, Infinity, 20],
    ]) {
      expect(() => mergeSignerInstantJson(source, { annotations: [{ ...mark, bbox }] }, 'participant-1')).toThrow(
        /Required signature field/,
      );
    }
    expect(() =>
      mergeSignerInstantJson(
        source,
        { annotations: [{ ...mark, customData: { signerID: 'someone-else' } }] },
        'participant-1',
      ),
    ).toThrow(/Required signature field/);
  });
  it('preserves canonical definitions and accepts an overlapping signer-owned mark', () => {
    const mark = {
      id: 'mark-1',
      type: 'pspdfkit/ink',
      pageIndex: 0,
      boundingBox: { left: 20, top: 15, width: 50, height: 20 },
      customData: { signerID: 'participant-1' },
    };
    const merged = mergeSignerInstantJson(
      canonical,
      { ...canonical, annotations: [mark], formFields: [] },
      'participant-1',
    );
    expect(merged.annotations).toEqual([widget, mark]);
    expect(merged.formFields).toEqual(canonical.formFields);
  });

  it('rejects another participant and missing signatures', () => {
    expect(() => mergeSignerInstantJson(canonical, canonical, 'participant-2')).toThrow(InvalidSigningPayloadError);
    expect(() => mergeSignerInstantJson(canonical, canonical, 'participant-1')).toThrow(/Required signature field/);
  });

  it('drops unrelated annotations instead of allowing document-wide edits', () => {
    const validMark = {
      id: 'mark-1',
      type: 'pspdfkit/ink',
      pageIndex: 0,
      boundingBox: { left: 20, top: 15, width: 50, height: 20 },
    };
    const injected = {
      id: 'text-evil',
      type: 'pspdfkit/text',
      pageIndex: 3,
      boundingBox: { left: 0, top: 0, width: 500, height: 500 },
    };
    const merged = mergeSignerInstantJson(canonical, { annotations: [validMark, injected] }, 'participant-1');
    expect(merged.annotations).toEqual([widget, validMark]);
  });

  it('does not accept arbitrary overlapping text as a signature', () => {
    const fakeTypedText = {
      id: 'fake-signature',
      type: 'pspdfkit/text',
      pageIndex: 0,
      boundingBox: { left: 20, top: 15, width: 50, height: 20 },
      customData: { signerID: 'participant-1' },
    };
    expect(() => mergeSignerInstantJson(canonical, { annotations: [fakeTypedText] }, 'participant-1')).toThrow(
      /Required signature field/,
    );
  });

  it('requires values for every supported data and checkbox field', () => {
    const fieldTypes = ['name', 'email', 'date', 'text', 'checkbox'];
    const widgets = fieldTypes.map((type, index) => ({
      ...widget,
      id: `widget-${index}`,
      formFieldName: `${type}_${index}`,
      boundingBox: { left: 10, top: 10 + index * 50, width: 100, height: 40 },
      customData: { signerID: 'participant-1', type },
    }));
    const valueFields = {
      annotations: widgets,
      formFields: widgets.map(({ formFieldName: name }) => ({ name })),
      formFieldValues: {},
    };
    const completedValues = {
      name_0: 'Resident One',
      email_1: 'resident@example.com',
      date_2: '09/08/2026',
      text_3: 'Approved',
      checkbox_4: ['Yes'],
    };

    expect(
      mergeSignerInstantJson(valueFields, { formFieldValues: completedValues }, 'participant-1').formFieldValues,
    ).toEqual(Object.entries(completedValues).map(([name, value]) => ({ name, value })));

    for (const fieldName of Object.keys(completedValues)) {
      const incompleteValues = { ...completedValues, [fieldName]: fieldName.startsWith('checkbox') ? [] : '' };
      expect(() => mergeSignerInstantJson(valueFields, { formFieldValues: incompleteValues }, 'participant-1')).toThrow(
        `Required ${fieldName.split('_')[0]} field ${fieldName} is empty`,
      );
    }
  });

  it('requires initials to contain a real signature mark', () => {
    const initialsWidget = {
      ...widget,
      formFieldName: 'initials_1',
      customData: { signerID: 'participant-1', type: 'initials' },
    };
    expect(() =>
      mergeSignerInstantJson(
        { annotations: [initialsWidget], formFields: [{ name: 'initials_1' }], formFieldValues: {} },
        { annotations: [] },
        'participant-1',
      ),
    ).toThrow(/Required signature field initials_1/);
  });

  it('fails closed for unknown signing field types', () => {
    const unknownWidget = {
      ...widget,
      formFieldName: 'dropdown_1',
      customData: { signerID: 'participant-1', type: 'dropdown' },
    };
    expect(() =>
      mergeSignerInstantJson(
        { annotations: [unknownWidget], formFields: [{ name: 'dropdown_1' }], formFieldValues: {} },
        { formFieldValues: { dropdown_1: ['One'] } },
        'participant-1',
      ),
    ).toThrow(/Unsupported signing field type dropdown/);
  });
});
