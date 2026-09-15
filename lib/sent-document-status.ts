import { documentDisplayStatus } from './document-display-status';

export function sentDocumentStatus(
  status: string | null,
  expiresAt: Date | null,
  signerCount: number | string,
  signedCount: number | string,
) {
  const pill = documentDisplayStatus(status, expiresAt);
  const total = Number(signerCount);
  const signed = Number(signedCount);
  const allSigned = total > 0 && signed === total;
  const progress = pill === 'pending' && allSigned
    ? 'Finalization pending'
    : pill === 'pending' && signed > 0 ? `${signed}/${total} Signed` : null;
  return { pill, progress, canCancel: (pill === 'pending' && !allSigned) || pill === 'wet' };
}
