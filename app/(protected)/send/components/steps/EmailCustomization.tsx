'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/sign-design/alert';
import { useDocumentFlow } from '../../context/DocumentFlowContext';

function EmailPreview({
  recipients,
  emailSubject,
  emailMessage,
  documentTitle,
  expiresAt,
}: {
  recipients: { id: string; name: string; email: string }[];
  emailSubject: string;
  emailMessage: string;
  documentTitle: string;
  expiresAt?: Date;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-2)',
        padding: 'var(--space-4)',
        background: 'var(--bg-elev)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}
        >
          Delivery sender
        </div>
        <div style={{ color: 'var(--ink)' }}>Configured email service sender (not shown in this preview)</div>
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}
        >
          To
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {recipients.map((recipient) => (
            <span key={recipient.id} className="tag" style={{ background: 'var(--surface)' }}>
              {recipient.name} &lt;{recipient.email}&gt;
            </span>
          ))}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
          }}
        >
          Subject
        </div>
        <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{emailSubject}</div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{emailMessage}</div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)' }}>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-2)',
              padding: 'var(--space-3)',
              textAlign: 'center',
            }}
          >
            <button type="button" className="btn" style={{ pointerEvents: 'none' }}>
              View and Sign Document
            </button>
            <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>
              {documentTitle} | Expires: {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'No expiration date'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmailCustomization() {
  const { state, dispatch } = useDocumentFlow();
  const [activeTab, setActiveTab] = useState<string>('compose');

  // Initialize local state with values from context
  const [emailSubject, setEmailSubject] = useState(state.email.subject);
  const [emailMessage, setEmailMessage] = useState(state.email.message);

  // Update context when form values change
  useEffect(() => {
    const isValid = emailSubject.trim() !== '' && emailMessage.trim() !== '';

    dispatch({
      type: 'SET_EMAIL',
      payload: {
        subject: emailSubject,
        message: emailMessage,
      },
    });

    dispatch({
      type: 'VALIDATE_STEP',
      payload: { step: 'step4Valid', isValid },
    });
  }, [emailSubject, emailMessage, dispatch]);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailSubject(e.target.value);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEmailMessage(e.target.value);
  };

  // Reset to default values
  const handleResetDefaults = () => {
    setEmailSubject('Please sign this document');
    setEmailMessage('I have sent you a document to sign. Please review and sign at your earliest convenience.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Heading row with title + step tag */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            Email Customization
          </h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
            Customize the invitation. In local evaluation, messages are captured in the private Mailpit inbox rather
            than sent to real addresses.
          </p>
        </div>
        <span className="tag">Step 4 of 5</span>
      </div>

      {/* Compose / Preview tabs */}
      <div className="tab-segmented">
        <button type="button" aria-pressed={activeTab === 'compose'} onClick={() => setActiveTab('compose')}>
          Compose
        </button>
        <button type="button" aria-pressed={activeTab === 'preview'} onClick={() => setActiveTab('preview')}>
          Preview
        </button>
      </div>

      {activeTab === 'compose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor="email-subject">Email subject</label>
            <input
              id="email-subject"
              type="text"
              value={emailSubject}
              onChange={handleSubjectChange}
              placeholder="Enter email subject"
            />
          </div>
          <div className="field">
            <label htmlFor="email-message">Email message</label>
            <textarea
              id="email-message"
              rows={8}
              value={emailMessage}
              onChange={handleMessageChange}
              placeholder="Enter your message to recipients"
              style={{ resize: 'vertical', minHeight: 160 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn ghost sm" onClick={handleResetDefaults}>
              Reset to defaults
            </button>
          </div>
          <Alert variant="info" title="Tips">
            Personalize your message to increase response rates. Include your contact information in case recipients
            have questions. Be clear about what action you&apos;re requesting from recipients.
          </Alert>
        </div>
      )}

      {activeTab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="eyebrow">Email Preview</div>
          <EmailPreview
            recipients={state.recipients}
            emailSubject={emailSubject}
            emailMessage={emailMessage}
            documentTitle={state.document.title || 'Document'}
            expiresAt={state.document.expiresAt}
          />
          <Alert variant="info">
            This is a content preview, not a delivered email. With email delivery configured, each activated signer
            is sent their own signing link. Sequential routing activates later signers only after earlier signers finish.
          </Alert>
        </div>
      )}
    </div>
  );
}
