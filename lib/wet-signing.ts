export function canStartWetSign(status: string | null): boolean {
  return status === 'DRAFT' || status === 'AWAITING_WET_SIGNATURE';
}

export function canAcceptWetSignedReturn(status: string | null, signingMethod: string | null): boolean {
  return status === 'AWAITING_WET_SIGNATURE' && signingMethod === 'WET';
}

import { PDFDocument } from 'pdf-lib';

/** Validate the returned artifact without rewriting the original scan. */
export async function validateWetSignedPdf(bytes: Uint8Array): Promise<string | null> {
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    if (pdf.getPageCount() === 0) return 'The returned PDF must contain at least one page.';
    return null;
  } catch {
    return 'The returned PDF is unreadable or password-protected. Upload an unlocked PDF.';
  }
}
