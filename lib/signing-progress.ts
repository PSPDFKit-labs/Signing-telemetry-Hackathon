interface SigningProgressEntry {
  request: { status: string | null };
  participant: { isRequired: boolean | null; signingOrder: number | null };
}

export function allRequiredSignaturesRecorded(entries: SigningProgressEntry[]): boolean {
  return entries.every(({ request, participant }) => participant.isRequired === false || request.status === 'SIGNED');
}

export function isSigningOrderComplete(entries: SigningProgressEntry[], currentOrder: number): boolean {
  return !entries.some(
    ({ request, participant }) =>
      participant.isRequired !== false &&
      (participant.signingOrder ?? 0) <= currentOrder &&
      request.status === 'PENDING',
  );
}
