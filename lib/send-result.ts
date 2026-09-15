export interface SendResult {
  downloadUrl?: string;
  created?: number;
  emailsSent?: number;
  emailsExpected?: number;
  alreadyCreated?: boolean;
  alreadySent?: boolean;
}

export function describeSendResult(result: SendResult, batch: boolean) {
  if (result.alreadyCreated || result.alreadySent) {
    return {
      title: batch ? 'Batch already exists' : 'Document already sent',
      description:
        'No new invitations were sent by this retry. Check the document records and use Resend for recipients who still need an invitation.',
      incomplete: false,
    };
  }
  const known = typeof result.emailsSent === 'number' && typeof result.emailsExpected === 'number';
  const incomplete = !known || (result.emailsSent ?? 0) < (result.emailsExpected ?? 0);
  return {
    title: incomplete ? 'Invitations need attention' : batch ? 'Batch invitations sent' : 'Signing invitations sent',
    description: known
      ? `${batch ? `${result.created ?? 0} envelopes created. ` : ''}${result.emailsSent} of ${result.emailsExpected} active-recipient invitations accepted by the email service.${incomplete ? ' Open the document records and use Resend for failed invitations.' : ' Later sequential signers are invited when their turn begins.'}`
      : 'The documents were saved, but invitation delivery was not confirmed. Check the document records before retrying.',
    incomplete,
  };
}
