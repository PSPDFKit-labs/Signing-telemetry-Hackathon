interface PositionedField {
  pageIndex: number;
  boundingBox: {
    top: number;
    left?: number;
  };
}

const AUTO_ADVANCE_FIELD_TYPES = new Set(['signature', 'initial', 'initials', 'checkbox']);

export function shouldAutoAdvanceAfterCompletion(fieldType: string): boolean {
  return AUTO_ADVANCE_FIELD_TYPES.has(fieldType);
}

export function sortFieldsInReadingOrder<T extends PositionedField>(fields: readonly T[]): T[] {
  return [...fields].sort((first, second) => {
    if (first.pageIndex !== second.pageIndex) return first.pageIndex - second.pageIndex;
    if (first.boundingBox.top !== second.boundingBox.top) return first.boundingBox.top - second.boundingBox.top;
    return (first.boundingBox.left ?? 0) - (second.boundingBox.left ?? 0);
  });
}
