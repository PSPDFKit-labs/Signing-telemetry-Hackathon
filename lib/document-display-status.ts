export type DocumentDisplayStatus =
  | 'pending'
  | 'signed'
  | 'draft'
  | 'expired'
  | 'declined'
  | 'cancelled'
  | 'wet'
  | 'unknown';

export function documentDisplayStatus(
  status: string | null,
  expiresAt: Date | null,
  now = new Date(),
): DocumentDisplayStatus {
  // Terminal outcomes do not become expired when the original deadline passes.
  if (status === 'COMPLETED') return 'signed';
  if (status === 'DECLINED') return 'declined';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'DRAFT') return 'draft';
  if (!['PENDING', 'IN_PROGRESS', 'AWAITING_WET_SIGNATURE'].includes(status ?? '')) return 'unknown';
  if (expiresAt && expiresAt <= now) return 'expired';
  if (status === 'AWAITING_WET_SIGNATURE') return 'wet';
  return 'pending';
}
