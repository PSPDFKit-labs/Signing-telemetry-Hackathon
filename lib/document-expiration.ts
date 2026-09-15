/** Document expiry dates remain valid through the end of their stored day. */
export function isDocumentExpired(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  const endOfDay = new Date(expiresAt);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < now;
}
