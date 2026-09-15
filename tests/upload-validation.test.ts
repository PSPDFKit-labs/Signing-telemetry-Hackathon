import { describe, expect, it } from 'vitest';
import { validateUploadContent } from '../lib/upload-validation';

describe('upload validation', () => {
  it('accepts a PDF only when extension, MIME type, and bytes agree', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n');
    expect(validateUploadContent('contract.pdf', 'application/pdf', pdf)).toBeNull();
    expect(validateUploadContent('contract.png', 'image/png', pdf)).toMatch(/bytes/);
    expect(validateUploadContent('contract.pdf', 'image/png', pdf)).toMatch(/extension and content type/);
  });

  it('recognizes ZIP-based Office documents and rejects disguised executables', () => {
    expect(
      validateUploadContent(
        'contract.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
      ),
    ).toBeNull();
    expect(validateUploadContent('scan.jpg', 'image/jpeg', new TextEncoder().encode('MZ executable'))).toMatch(/bytes/);
  });
});
