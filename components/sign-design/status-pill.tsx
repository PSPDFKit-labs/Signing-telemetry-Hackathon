import type { DocumentDisplayStatus as Status } from '@/lib/document-display-status';

const LABELS: Record<Status, string> = {
  pending: 'Pending',
  signed: 'Completed',
  draft: 'Draft',
  expired: 'Expired',
  declined: 'Declined',
  cancelled: 'Cancelled',
  wet: 'Awaiting wet signature',
  unknown: 'Unknown',
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${status}`}>{LABELS[status]}</span>;
}

export type { Status as StatusPillStatus };
