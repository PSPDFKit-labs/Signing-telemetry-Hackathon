import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { mergePdfPacket } from '@/lib/document-packets';

async function pdfWithPages(pageCount: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([612, 792]);
  }
  return document.save();
}

describe('mergePdfPacket', () => {
  it('preserves document order and page boundaries', async () => {
    const first = await pdfWithPages(2);
    const second = await pdfWithPages(3);
    const result = await mergePdfPacket([
      { name: 'Lease.pdf', size: first.length, bytes: first },
      { name: 'Addendum.pdf', size: second.length, bytes: second },
    ]);

    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(5);
    expect(result.manifest).toEqual({
      version: 1,
      documentCount: 2,
      pageCount: 5,
      documents: [
        { name: 'Lease.pdf', size: first.length, pageStart: 1, pageEnd: 2, pageCount: 2 },
        { name: 'Addendum.pdf', size: second.length, pageStart: 3, pageEnd: 5, pageCount: 3 },
      ],
    });
  });

  it('rejects unreadable PDFs', async () => {
    await expect(mergePdfPacket([{ name: 'bad.pdf', size: 3, bytes: new Uint8Array([1, 2, 3]) }])).rejects.toThrow(
      'bad.pdf is not a readable PDF',
    );
  });
});
