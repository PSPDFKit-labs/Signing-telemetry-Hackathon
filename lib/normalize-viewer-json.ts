/** Normalizes legacy form values to the Instant JSON schema required by the viewer. */
export function normalizeViewerJson<T extends Record<string, unknown>>(snapshot: T): T {
  const values = snapshot.formFieldValues;
  if (!values || typeof values !== 'object') return snapshot;

  // Older evaluation snapshots omitted the required Instant JSON `v` and `type`
  // fields, and some stored values as a name/value map rather than an array.
  const normalizeValue = (name: string, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { v: 1, type: 'pspdfkit/form-field-value', ...(value as Record<string, unknown>), name };
    }
    return { v: 1, type: 'pspdfkit/form-field-value', name, value };
  };

  if (Array.isArray(values)) {
    return {
      ...snapshot,
      formFieldValues: values.map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
        const record = entry as Record<string, unknown>;
        return normalizeValue(typeof record.name === 'string' ? record.name : '', record);
      }),
    } as T;
  }

  return { ...snapshot, formFieldValues: Object.entries(values).map(([name, value]) => normalizeValue(name, value)) } as T;
}
