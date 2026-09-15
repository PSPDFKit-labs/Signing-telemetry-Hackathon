export interface SignatureStorageKeys {
  attachments: string;
  signatures: string;
}

/** Isolates reusable signature material to one browser tab, document, and participant. */
export function signatureStorageKeys(documentId: string, participantId: string): SignatureStorageKeys {
  const scope = `${documentId}:${participantId}`;
  return {
    signatures: `nutrient_signatures_storage:${scope}`,
    attachments: `nutrient_attachments_storage:${scope}`,
  };
}
