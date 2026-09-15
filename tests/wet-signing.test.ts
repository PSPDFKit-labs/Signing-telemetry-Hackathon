import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { canAcceptWetSignedReturn, canStartWetSign, validateWetSignedPdf } from '@/lib/wet-signing';

describe('wet-sign lifecycle', () => {
  it('rejects a header-only fake PDF before reconciliation', async () => {
    expect(await validateWetSignedPdf(new TextEncoder().encode('%PDF-1.7\nnot a document'))).not.toBeNull();
  });

  it('accepts a readable returned PDF without modifying its bytes', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Signed paper agreement');
    const bytes = await pdf.save();
    const original = bytes.slice();
    expect(await validateWetSignedPdf(bytes)).toBeNull();
    expect(bytes).toEqual(original);
  });

  it('rejects a PDF with no pages', async () => {
    const pdf = await PDFDocument.create();
    expect(await validateWetSignedPdf(await pdf.save({ addDefaultPage: false }))).not.toBeNull();
  });
  it('starts from a draft and permits repeat downloads while awaiting return', () => {
    expect(canStartWetSign('DRAFT')).toBe(true);
    expect(canStartWetSign('AWAITING_WET_SIGNATURE')).toBe(true);
    expect(canStartWetSign('COMPLETED')).toBe(false);
  });

  it('accepts a return only for a wet-sign document in the waiting state', () => {
    expect(canAcceptWetSignedReturn('AWAITING_WET_SIGNATURE', 'WET')).toBe(true);
    expect(canAcceptWetSignedReturn('AWAITING_WET_SIGNATURE', 'ELECTRONIC')).toBe(false);
    expect(canAcceptWetSignedReturn('COMPLETED', 'WET')).toBe(false);
  });
});
