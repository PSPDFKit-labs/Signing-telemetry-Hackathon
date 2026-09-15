import { PDFDocument } from 'pdf-lib';

export const MAX_PACKET_DOCUMENTS = 25;

export interface PacketSourceDocument {
  name: string;
  size: number;
  pageStart: number;
  pageEnd: number;
  pageCount: number;
}

export interface PacketManifest {
  version: 1;
  documentCount: number;
  pageCount: number;
  documents: PacketSourceDocument[];
}

export async function mergePdfPacket(
  sources: Array<{ name: string; size: number; bytes: Uint8Array }>,
): Promise<{ bytes: Uint8Array; manifest: PacketManifest }> {
  if (sources.length === 0) throw new Error('A packet requires at least one PDF');
  if (sources.length > MAX_PACKET_DOCUMENTS) {
    throw new Error(`A packet can contain at most ${MAX_PACKET_DOCUMENTS} PDFs`);
  }

  const merged = await PDFDocument.create();
  const documents: PacketSourceDocument[] = [];
  let pageOffset = 0;

  for (const source of sources) {
    let input: PDFDocument;
    try {
      input = await PDFDocument.load(source.bytes, { updateMetadata: false });
    } catch {
      throw new Error(`${source.name} is not a readable PDF`);
    }
    const pageIndices = input.getPageIndices();
    if (pageIndices.length === 0) throw new Error(`${source.name} has no pages`);
    const copiedPages = await merged.copyPages(input, pageIndices);
    for (const page of copiedPages) merged.addPage(page);

    documents.push({
      name: source.name,
      size: source.size,
      pageStart: pageOffset + 1,
      pageEnd: pageOffset + pageIndices.length,
      pageCount: pageIndices.length,
    });
    pageOffset += pageIndices.length;
  }

  return {
    bytes: await merged.save(),
    manifest: {
      version: 1,
      documentCount: documents.length,
      pageCount: pageOffset,
      documents,
    },
  };
}
