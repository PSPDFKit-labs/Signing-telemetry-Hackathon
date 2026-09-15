'use client';

import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/sign-design/alert';
import { IconClock } from '@/components/sign-design/icons';
import { RecipientAvatar } from '@/components/sign-design/recipient-avatar';
import { ReviewBlock } from '@/components/sign-design/review-block';
import { useToast } from '@/components/ui/use-toast';
import { describeSendResult, type SendResult } from '@/lib/send-result';
import { useDocumentFlow } from '../../context/DocumentFlowContext';

export default function ReviewAndSend() {
  const { state, dispatch } = useDocumentFlow();
  const { toast } = useToast();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  // Set this step as valid on component mount
  useEffect(() => {
    dispatch({
      type: 'VALIDATE_STEP',
      payload: { step: 'step5Valid', isValid: true },
    });
  }, [dispatch]);

  const handleSendDocument = async () => {
    if (!state.document.id) {
      toast({
        title: 'Missing document ID',
        description: 'Cannot send document without an ID. Please make sure the document is saved first.',
        variant: 'destructive',
      });
      return;
    }

    if (state.recipients.length === 0 && !(state.userWillSign && state.userDisplayName)) {
      toast({
        title: 'No recipients',
        description: 'You must add at least one recipient before sending the document.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const isRepapering = state.repaperingRecipients.length > 0;
      const isWetSign = state.document.signingMethod === 'WET';
      const endpoint = isWetSign ? 'wet-sign' : isRepapering ? 'repaper' : 'send';
      const response = await fetch(`/api/documents/${state.document.id}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailSubject: state.email.subject,
          emailMessage: state.email.message,
          finalizationMode: state.document.finalizationMode,
          signingMethod: state.document.signingMethod,
          ...(isRepapering
            ? {
                batchId: state.repaperingBatchId,
                recipients: state.repaperingRecipients.map(({ name, email }) => ({ name, email })),
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send document');
      }

      const result = (await response.json()) as SendResult;

      if (isWetSign && result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `${state.document.title}-wet-sign.pdf`;
        link.click();
      }

      const summary = describeSendResult(result, isRepapering);
      toast({
        title: isWetSign ? 'Wet-sign packet ready' : summary.title,
        description: isWetSign
          ? 'The print packet download was requested. Upload the signed return from the document details page.'
          : summary.description,
        variant: !isWetSign && summary.incomplete ? 'destructive' : 'default',
      });

      // Redirect to dashboard after successful send
      router.push(isRepapering ? '/documents' : `/documents/${state.document.id}`);
    } catch (error) {
      console.error('Error sending document:', error);
      toast({
        title: 'Failed to send document',
        description:
          error instanceof Error ? error.message : 'There was an error sending your document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Format roles to be more readable
  const formatRole = (role: string) => {
    switch (role) {
      case 'signer':
        return 'Needs to sign';
      case 'viewer':
        return 'Can view only';
      case 'cc':
        return 'Receives a copy';
      default:
        return role;
    }
  };

  const recipientCount = state.repaperingRecipients.length || state.recipients.length + (state.userWillSign ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Heading row */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            Review and Send
          </h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
            One last look before the document goes out.
          </p>
        </div>
        <span className="tag">Step 5 of 5</span>
      </div>

      {/* Document */}
      <ReviewBlock title="Document" onEdit={() => dispatch({ type: 'SET_STEP', payload: 1 })}>
        <div style={{ color: 'var(--ink)' }}>{state.document.title || 'Untitled document'}</div>
        {state.document.saveAsTemplate && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginTop: 4 }}>
            Will be saved as template: {state.document.templateName || state.document.title}
          </div>
        )}
        {state.document.expiresAt && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-4)',
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconClock aria-hidden="true" /> Expires {format(state.document.expiresAt, 'MMMM d, yyyy')}
          </div>
        )}
      </ReviewBlock>

      {/* Recipients */}
      <ReviewBlock title={`Recipients (${recipientCount})`} onEdit={() => dispatch({ type: 'SET_STEP', payload: 2 })}>
        {state.repaperingRecipients.length > 0 && (
          <Alert variant="info" title="High-volume repapering">
            One isolated envelope will be created per CSV row. The field layout configured for{' '}
            {state.recipients[0]?.name} will be retargeted to each resident.
          </Alert>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {state.userWillSign && state.userDisplayName && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RecipientAvatar name={state.userDisplayName} />
              <span style={{ color: 'var(--ink)' }}>{state.userDisplayName}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}>(you)</span>
            </div>
          )}
          {(state.repaperingRecipients.length > 0 ? state.repaperingRecipients : state.recipients).map((recipient) => (
            <div key={recipient.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <RecipientAvatar name={recipient.name || 'Recipient'} />
              <span style={{ color: 'var(--ink)' }}>{recipient.name || '—'}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}>{recipient.email}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {state.signingOrder === 'sequential' && recipient.role === 'signer' && (
                  <span className="tag mono" style={{ fontSize: 'var(--text-xs)' }}>
                    #{recipient.signingOrder}
                  </span>
                )}
                <span className="tag">{formatRole(recipient.role)}</span>
              </span>
            </div>
          ))}
          {state.repaperingRecipients.length === 0 &&
          (state.recipients.length > 1 || (state.recipients.length >= 1 && state.userWillSign)) ? (
            <div
              style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)', marginTop: 6, textTransform: 'capitalize' }}
            >
              Signing order: {state.signingOrder}
            </div>
          ) : null}
        </div>
      </ReviewBlock>

      {/* Fields */}
      <ReviewBlock title={`Fields (${state.fields.length})`} onEdit={() => dispatch({ type: 'SET_STEP', payload: 3 })}>
        {state.fields.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {state.fields.map((field) => (
              <span key={field.id} className="tag" style={{ textTransform: 'capitalize' }}>
                {field.type === 'initial' ? 'Initials' : field.type}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)' }}>
            No fields placed. Recipients won't have specific places to sign or fill in information.
          </div>
        )}
      </ReviewBlock>

      {/* Message */}
      <ReviewBlock title="Message" onEdit={() => dispatch({ type: 'SET_STEP', payload: 4 })}>
        <div style={{ color: 'var(--ink)', fontWeight: 500, marginBottom: 4 }}>{state.email.subject}</div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
          {state.email.message}
        </div>
      </ReviewBlock>

      <ReviewBlock title="Signing method">
        <div className="radio-group">
          <label className={`radio-row ${state.document.signingMethod === 'ELECTRONIC' ? 'checked' : ''}`}>
            <input
              type="radio"
              name="signing-method"
              checked={state.document.signingMethod === 'ELECTRONIC'}
              onChange={() => dispatch({ type: 'SET_DOCUMENT', payload: { signingMethod: 'ELECTRONIC' } })}
            />
            <span className="radio-mark" />
            <div className="radio-body">
              <strong>Electronic signing</strong>
              <span>Send secure signing links and complete the document online.</span>
            </div>
          </label>
          <label className={`radio-row ${state.document.signingMethod === 'WET' ? 'checked' : ''}`}>
            <input
              type="radio"
              name="signing-method"
              checked={state.document.signingMethod === 'WET'}
              disabled={state.repaperingRecipients.length > 0}
              onChange={() => dispatch({ type: 'SET_DOCUMENT', payload: { signingMethod: 'WET' } })}
            />
            <span className="radio-mark" />
            <div className="radio-body">
              <strong>Wet signature</strong>
              <span>
                {state.repaperingRecipients.length > 0
                  ? 'Clear the repapering batch before choosing an offline return workflow.'
                  : 'Download a print packet, route it offline, then upload and reconcile the signed PDF.'}
              </span>
            </div>
          </label>
        </div>
      </ReviewBlock>

      {state.document.signingMethod === 'ELECTRONIC' && (
        <ReviewBlock title="Finalization">
          <div className="radio-group">
            <label className={`radio-row ${state.document.finalizationMode === 'ELECTRONIC' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="finalization-mode"
                checked={state.document.finalizationMode === 'ELECTRONIC'}
                onChange={() => dispatch({ type: 'SET_DOCUMENT', payload: { finalizationMode: 'ELECTRONIC' } })}
              />
              <span className="radio-mark" />
              <div className="radio-body">
                <strong>Electronic signatures only</strong>
                <span>Flatten the completed fields and signatures without applying a cryptographic document seal.</span>
              </div>
            </label>
            <label className={`radio-row ${state.document.finalizationMode === 'DIGITAL_SEAL' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="finalization-mode"
                checked={state.document.finalizationMode === 'DIGITAL_SEAL'}
                onChange={() => dispatch({ type: 'SET_DOCUMENT', payload: { finalizationMode: 'DIGITAL_SEAL' } })}
              />
              <span className="radio-mark" />
              <div className="radio-body">
                <strong>Apply Nutrient DWS digital seal</strong>
                <span>Add a tamper-evident PAdES B-LT signature after all recipients finish.</span>
              </div>
            </label>
          </div>
          <Alert variant="warn" title="DWS digital sealing is deferred for this evaluation">
            Keep <strong>Electronic signatures only</strong> selected for the Resident Interface POC. The
            digital-seal path remains visible for evaluation, but it is not configured or included in this handoff.
          </Alert>
        </ReviewBlock>
      )}

      {/* What happens next info */}
      <Alert variant="info" title="What happens next?">
        {state.document.signingMethod === 'WET' ? (
          <>
            The printable packet will download now. Its status remains “Awaiting wet-signed return” until you upload it.
          </>
        ) : (
          <>
            Send creates recipient-specific signing requests. Email invitations require a configured delivery service;
            without one, use Open signing session on the document page for local evaluation.
          </>
        )}{' '}
        {state.document.signingMethod === 'ELECTRONIC' && state.signingOrder === 'sequential'
          ? ' Sequential routing activates recipients in the order you specified.'
          : state.document.signingMethod === 'ELECTRONIC'
            ? ' Parallel routing activates all signing recipients together.'
            : null}
      </Alert>

      {/* Send button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn"
          onClick={handleSendDocument}
          disabled={isSending}
          aria-busy={isSending}
          style={{ minWidth: 140 }}
        >
          {isSending
            ? 'Processing…'
            : state.document.signingMethod === 'WET'
              ? 'Export for wet signature'
              : 'Send Document'}
        </button>
      </div>
    </div>
  );
}
