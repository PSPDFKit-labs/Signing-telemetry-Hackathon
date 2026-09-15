export function storageKeyFromPath(filePath: string): string | null {
  try {
    if (!filePath.startsWith('http')) return decodeURIComponent(filePath.replace(/^\/+/, ''));
    return decodeURIComponent(new URL(filePath).pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
}

export function isUserUploadPath(filePath: string, userId: string): boolean {
  const key = storageKeyFromPath(filePath);
  if (!key) return false;
  const prefix = `uploads/${userId}/`;
  const filename = key.startsWith(prefix) ? key.slice(prefix.length) : '';
  return Boolean(filename) && !filename.includes('/') && filename !== '.' && filename !== '..';
}
