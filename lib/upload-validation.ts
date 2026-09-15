const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  pdf: new Set(['application/pdf']),
  doc: new Set(['application/msword']),
  docx: new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  xls: new Set(['application/vnd.ms-excel']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ppt: new Set(['application/vnd.ms-powerpoint']),
  pptx: new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  jpg: new Set(['image/jpeg']),
  jpeg: new Set(['image/jpeg']),
  png: new Set(['image/png']),
  tif: new Set(['image/tiff']),
  tiff: new Set(['image/tiff']),
};

function beginsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

export function validateUploadContent(filename: string, contentType: string, bytes: Uint8Array): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension || !MIME_BY_EXTENSION[extension]?.has(contentType)) {
    return 'The file extension and content type do not match an allowed document format.';
  }

  const isPdf = beginsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  const isZip = beginsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = beginsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const isJpeg = beginsWith(bytes, [0xff, 0xd8, 0xff]);
  const isPng = beginsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isTiff = beginsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || beginsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
  const signatureMatches =
    (extension === 'pdf' && isPdf) ||
    (['docx', 'xlsx', 'pptx'].includes(extension) && isZip) ||
    (['doc', 'xls', 'ppt'].includes(extension) && isOle) ||
    (['jpg', 'jpeg'].includes(extension) && isJpeg) ||
    (extension === 'png' && isPng) ||
    (['tif', 'tiff'].includes(extension) && isTiff);

  return signatureMatches ? null : 'The uploaded bytes do not match the declared file type.';
}
