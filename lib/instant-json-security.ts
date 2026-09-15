import { getSigningFieldType, hasRequiredFieldValue, SIGNATURE_FIELD_TYPES, VALUE_FIELD_TYPES } from './signing-fields';

const MAX_INSTANT_JSON_BYTES = 8 * 1024 * 1024;
const ALLOWED_SIGNER_ANNOTATION_TYPES = new Set(['pspdfkit/ink', 'pspdfkit/image', 'pspdfkit/text']);
const SIGNATURE_ANNOTATION_TYPES = new Set(['pspdfkit/ink', 'pspdfkit/image']);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getRect(value: unknown): { left: number; top: number; width: number; height: number } | null {
  // Instant JSON serializes geometry as bbox: [left, top, width, height].
  // Older application fixtures stored the SDK's in-memory boundingBox object.
  if (Array.isArray(value)) {
    if (value.length !== 4) return null;
    const [left, top, width, height] = value;
    return getRect({ left, top, width, height });
  }
  if (!isRecord(value)) return null;
  const { left, top, width, height } = value;
  if (![left, top, width, height].every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
  if ((width as number) <= 0 || (height as number) <= 0) return null;
  return { left: left as number, top: top as number, width: width as number, height: height as number };
}

function intersects(first: ReturnType<typeof getRect>, second: ReturnType<typeof getRect>): boolean {
  if (!first || !second) return false;
  return (
    first.left < second.left + second.width &&
    first.left + first.width > second.left &&
    first.top < second.top + second.height &&
    first.top + first.height > second.top
  );
}

function annotationOwner(annotation: JsonRecord): string | null {
  const customData = isRecord(annotation.customData) ? annotation.customData : null;
  const owner = customData?.signerID ?? customData?.recipientId;
  return typeof owner === 'string' ? owner : null;
}

function annotationId(annotation: JsonRecord): string | null {
  return typeof annotation.id === 'string' ? annotation.id : null;
}

function annotationPage(annotation: JsonRecord): number | null {
  return typeof annotation.pageIndex === 'number' && Number.isInteger(annotation.pageIndex)
    ? annotation.pageIndex
    : null;
}

function sanitizeAttachments(current: unknown, submitted: unknown, allowedAnnotations: JsonRecord[]): unknown {
  const referencedIds = new Set(
    allowedAnnotations
      .map((annotation) => annotation.imageAttachmentId)
      .filter((id): id is string => typeof id === 'string'),
  );

  if (Array.isArray(submitted)) {
    const existing = Array.isArray(current) ? current : [];
    const additions = submitted.filter(
      (attachment) => isRecord(attachment) && typeof attachment.id === 'string' && referencedIds.has(attachment.id),
    );
    return [...existing, ...additions];
  }

  if (isRecord(submitted)) {
    const result: JsonRecord = isRecord(current) ? { ...current } : {};
    for (const id of referencedIds) {
      if (id in submitted) result[id] = submitted[id];
    }
    return result;
  }

  return current;
}

function formFieldValueMap(value: unknown): Map<string, unknown> {
  if (Array.isArray(value)) {
    return new Map(
      value
        .filter(isRecord)
        .filter((entry) => typeof entry.name === 'string')
        .map((entry) => [entry.name as string, entry.value]),
    );
  }
  if (isRecord(value)) return new Map(Object.entries(value));
  return new Map();
}

function serializeFormFieldValues(_original: unknown, values: Map<string, unknown>): unknown {
  return [...values.entries()].map(([name, value]) => ({ name, value }));
}

export class InvalidSigningPayloadError extends Error {}

/**
 * Merges only changes that belong to the active participant. Canonical field
 * definitions and annotations are never replaced or deleted by the browser.
 */
export function mergeSignerInstantJson(
  currentValue: unknown,
  submittedValue: unknown,
  participantId: string,
): JsonRecord {
  if (!isRecord(currentValue) || !isRecord(submittedValue)) {
    throw new InvalidSigningPayloadError('InstantJSON must be an object');
  }
  if (Buffer.byteLength(JSON.stringify(submittedValue), 'utf8') > MAX_INSTANT_JSON_BYTES) {
    throw new InvalidSigningPayloadError('InstantJSON exceeds the 8 MB signing limit');
  }

  const currentAnnotations = records(currentValue.annotations);
  const submittedAnnotations = records(submittedValue.annotations);
  const currentIds = new Set(currentAnnotations.map(annotationId).filter((id): id is string => Boolean(id)));
  const ownedWidgets = currentAnnotations.filter(
    (annotation) => annotation.type === 'pspdfkit/widget' && annotationOwner(annotation) === participantId,
  );
  if (ownedWidgets.length === 0) {
    throw new InvalidSigningPayloadError('No signing fields are assigned to this recipient');
  }

  const allowedNewAnnotations = submittedAnnotations.filter((annotation) => {
    const id = annotationId(annotation);
    if (!id || currentIds.has(id) || !ALLOWED_SIGNER_ANNOTATION_TYPES.has(String(annotation.type))) return false;

    const explicitOwner = annotationOwner(annotation);
    if (annotation.type === 'pspdfkit/text') {
      const customData = isRecord(annotation.customData) ? annotation.customData : null;
      return explicitOwner === participantId && customData?.purpose === 'signer-audit-id';
    }
    if (explicitOwner) return explicitOwner === participantId;
    return ownedWidgets.some(
      (widget) =>
        annotationPage(widget) === annotationPage(annotation) &&
        intersects(getRect(widget.bbox ?? widget.boundingBox), getRect(annotation.bbox ?? annotation.boundingBox)),
    );
  });

  const ownedFieldNames = new Set(
    ownedWidgets.map((widget) => widget.formFieldName).filter((name): name is string => typeof name === 'string'),
  );
  const currentValues = formFieldValueMap(currentValue.formFieldValues);
  const submittedValues = formFieldValueMap(submittedValue.formFieldValues);
  const mergedValues = new Map(currentValues);
  for (const fieldName of ownedFieldNames) {
    if (submittedValues.has(fieldName)) mergedValues.set(fieldName, submittedValues.get(fieldName));
  }

  for (const widget of ownedWidgets) {
    const fieldName = typeof widget.formFieldName === 'string' ? widget.formFieldName : '';
    const customData = isRecord(widget.customData) ? widget.customData : {};
    const fieldType = getSigningFieldType(customData.type, fieldName);

    if (VALUE_FIELD_TYPES.has(fieldType)) {
      const value = mergedValues.get(fieldName);
      if (!hasRequiredFieldValue(value)) {
        throw new InvalidSigningPayloadError(`Required ${fieldType} field ${fieldName} is empty`);
      }
      continue;
    }

    if (!SIGNATURE_FIELD_TYPES.has(fieldType)) {
      throw new InvalidSigningPayloadError(`Unsupported signing field type ${fieldType || 'unknown'}`);
    }

    const hasSignature = allowedNewAnnotations.some(
      (annotation) =>
        SIGNATURE_ANNOTATION_TYPES.has(String(annotation.type)) &&
        annotationPage(annotation) === annotationPage(widget) &&
        intersects(getRect(annotation.bbox ?? annotation.boundingBox), getRect(widget.bbox ?? widget.boundingBox)),
    );
    if (!hasSignature) {
      throw new InvalidSigningPayloadError(`Required signature field ${fieldName} is empty`);
    }
  }

  const merged: JsonRecord = {
    ...currentValue,
    annotations: [...currentAnnotations, ...allowedNewAnnotations],
    formFields: currentValue.formFields,
    formFieldValues: serializeFormFieldValues(currentValue.formFieldValues, mergedValues),
  };
  if ('attachments' in currentValue || 'attachments' in submittedValue) {
    merged.attachments = sanitizeAttachments(
      currentValue.attachments,
      submittedValue.attachments,
      allowedNewAnnotations,
    );
  }
  return merged;
}
