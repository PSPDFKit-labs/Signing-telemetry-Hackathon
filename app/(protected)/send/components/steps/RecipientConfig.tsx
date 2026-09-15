'use client';

import { useSession } from 'next-auth/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Alert } from '@/components/sign-design/alert';
import { IconClock, IconPlus, IconTrashSmall } from '@/components/sign-design/icons';
import { ReactDatePickerCustom } from '@/components/ui/react-datepicker';
import { parseRecipientCsv } from '@/lib/repapering';
import { useDocumentFlow } from '../../context/DocumentFlowContext';

export default function RecipientConfig() {
  const { state, dispatch } = useDocumentFlow();
  const [validateAttempt, setValidateAttempt] = useState(false);
  const [isOnlySigner, setIsOnlySigner] = useState(false);
  const nameInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const emailInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvStatus, setCsvStatus] = useState('');
  const { data: session } = useSession();

  // Initialize user display name with session name on mount
  useEffect(() => {
    if (session?.user?.name && !state.userDisplayName) {
      dispatch({
        type: 'SET_USER_DISPLAY_NAME',
        payload: session.user.name,
      });
    }
  }, [session?.user?.name, state.userDisplayName, dispatch]);

  // Email validation helper
  const isValidEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Validate required recipient fields - wrapped in useCallback to prevent infinite loops
  const validateRecipients = useCallback(() => {
    // If user will sign, make sure they have provided their name
    if (state.userWillSign && !state.userDisplayName?.trim()) {
      return false;
    }

    // If user is the only signer, step is valid
    if (state.userWillSign && state.recipients.length === 0 && isOnlySigner) {
      return true;
    }

    // If user will sign (but not as the only signer) and there are no recipients, step is invalid
    if (state.userWillSign && state.recipients.length === 0 && !isOnlySigner) {
      return false;
    }

    // If there are no recipients and user isn't signing, step is invalid
    if (state.recipients.length === 0 && !state.userWillSign) {
      return false;
    }

    // For cases where we have recipients
    // Check that all recipients have required fields filled
    const userEmail = session?.user?.email?.toLowerCase();
    const allRecipientsValid = state.recipients.every((recipient) => {
      // Basic validation for name and email
      const hasValidName = recipient.name.trim() !== '';
      const hasValidEmail = recipient.email.trim() !== '' && isValidEmail(recipient.email);

      // If "I will also sign" is checked, reject recipients with the user's own email
      const isDuplicateOfSelf = state.userWillSign && userEmail && recipient.email.trim().toLowerCase() === userEmail;

      return hasValidName && hasValidEmail && !isDuplicateOfSelf;
    });

    return allRecipientsValid;
  }, [state.userWillSign, state.userDisplayName, state.recipients, isOnlySigner, isValidEmail, session?.user?.email]);

  // Validate the recipients whenever dependencies change
  useEffect(() => {
    const isValid = validateRecipients();
    dispatch({
      type: 'VALIDATE_STEP',
      payload: { step: 'step2Valid', isValid },
    });
  }, [validateRecipients, dispatch]);

  // Check if the DocumentFlow component is attempting to navigate to the next step
  useEffect(() => {
    const handleBeforeNextStep = () => {
      if (state.currentStep === 2 && !validateRecipients()) {
        setValidateAttempt(true);
      }
    };

    window.addEventListener('beforeDocumentFlowNext', handleBeforeNextStep);
    return () => {
      window.removeEventListener('beforeDocumentFlowNext', handleBeforeNextStep);
    };
  }, [state.currentStep, validateRecipients]);

  // Add a new recipient
  const addRecipient = () => {
    if (state.repaperingRecipients.length > 0) {
      dispatch({ type: 'SET_REPAPERING_RECIPIENTS', payload: [] });
      setCsvStatus('Bulk repapering cleared because the recipient list was changed.');
    }
    const newId = uuidv4();
    const newRecipientOrder =
      state.recipients.length > 0 ? Math.max(...state.recipients.map((r) => r.signingOrder)) + 1 : 1;

    dispatch({
      type: 'ADD_RECIPIENT',
      payload: {
        id: newId,
        name: '',
        email: '',
        role: 'signer',
        signingOrder: newRecipientOrder,
      },
    });

    // Focus the name input after a short delay to allow rendering
    setTimeout(() => {
      const nameInput = nameInputRefs.current[newId];
      if (nameInput) {
        nameInput.focus();
      }
    }, 0);
  };

  // Remove a recipient
  const removeRecipient = (id: string) => {
    if (state.repaperingRecipients.length > 0) {
      dispatch({ type: 'SET_REPAPERING_RECIPIENTS', payload: [] });
      setCsvStatus('Bulk repapering cleared because the template recipient was removed.');
    }
    dispatch({
      type: 'REMOVE_RECIPIENT',
      payload: { id },
    });

    // Update signing order for remaining recipients if using sequential signing
    if (state.signingOrder === 'sequential') {
      updateSigningOrder();
    }
  };

  // Update recipient information
  const updateRecipient = (id: string, field: string, value: string) => {
    dispatch({
      type: 'UPDATE_RECIPIENT',
      payload: {
        id,
        data: { [field]: value },
      },
    });
    if (state.repaperingRecipients.length > 0 && state.recipients[0]?.id === id) {
      dispatch({
        type: 'SET_REPAPERING_RECIPIENTS',
        payload: state.repaperingRecipients.map((recipient, index) =>
          index === 0 ? { ...recipient, [field]: value } : recipient,
        ),
      });
    }
  };

  const importRecipientCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = parseRecipientCsv(await file.text());
    if (result.errors.length > 0) {
      setCsvStatus(
        `Could not import: ${result.errors
          .slice(0, 3)
          .map((error) => `row ${error.row} ${error.message.toLowerCase()}`)
          .join('; ')}`,
      );
      return;
    }
    if (result.recipients.length === 0) {
      setCsvStatus('Could not import: no recipient rows found.');
      return;
    }

    const recipients = result.recipients.map((recipient, index) => ({
      id: uuidv4(),
      name: recipient.name,
      email: recipient.email,
      role: 'signer' as const,
      signingOrder: index + 1,
    }));
    dispatch({ type: 'SET_REPAPERING_RECIPIENTS', payload: recipients });
    dispatch({ type: 'SET_RECIPIENTS', payload: [recipients[0]] });
    dispatch({ type: 'SET_USER_WILL_SIGN', payload: false });
    dispatch({ type: 'SET_SIGNING_ORDER', payload: 'parallel' });
    dispatch({ type: 'SET_DOCUMENT', payload: { signingMethod: 'ELECTRONIC' } });
    setIsOnlySigner(false);
    setCsvStatus(
      `Loaded ${recipients.length} residents. Configure fields once for ${recipients[0].name}; the layout will be copied to every envelope.`,
    );
  };

  // Toggle whether the user will sign the document
  const toggleUserWillSign = (checked: boolean) => {
    dispatch({
      type: 'SET_USER_WILL_SIGN',
      payload: checked,
    });

    // If user unchecks "I will also sign" and there are no recipients,
    // make sure step is invalid
    if (!checked) {
      setIsOnlySigner(false);

      if (state.recipients.length === 0) {
        dispatch({
          type: 'VALIDATE_STEP',
          payload: { step: 'step2Valid', isValid: false },
        });
      }
    }
  };

  // Toggle "I am the only signer" option
  const toggleOnlySigner = (checked: boolean) => {
    setIsOnlySigner(checked);

    if (checked) {
      // Remove all recipients if user is the only signer
      state.recipients.forEach((recipient) => {
        removeRecipient(recipient.id);
      });

      // Validate the step as true since user will be the only signer and has a name
      dispatch({
        type: 'VALIDATE_STEP',
        payload: { step: 'step2Valid', isValid: !!state.userDisplayName?.trim() },
      });
    } else {
      // When unchecking "I am the only signer", the step should be invalid until a recipient is added
      dispatch({
        type: 'VALIDATE_STEP',
        payload: { step: 'step2Valid', isValid: false },
      });

      // User can now add recipients again
      setValidateAttempt(false);
    }
  };

  // Set the signing order (sequential or parallel)
  const setSigningOrder = (value: 'sequential' | 'parallel') => {
    dispatch({
      type: 'SET_SIGNING_ORDER',
      payload: value,
    });

    // If switching to sequential, update the signing order
    if (value === 'sequential') {
      updateSigningOrder();
    }
  };

  // Update the signing order for all recipients
  const updateSigningOrder = () => {
    // Sort current recipients by their signing order
    const sortedRecipients = [...state.recipients].sort((a, b) => a.signingOrder - b.signingOrder);

    // Reassign order numbers sequentially
    sortedRecipients.forEach((recipient, index) => {
      dispatch({
        type: 'UPDATE_RECIPIENT',
        payload: {
          id: recipient.id,
          data: { signingOrder: index + 1 },
        },
      });
    });
  };

  // Update user's display name
  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_USER_DISPLAY_NAME',
      payload: e.target.value,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Heading */}
      <div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Add Recipients</h2>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
          Add recipients to sign or review your document.
        </p>
      </div>

      {/* A. User-sign block */}
      <div>
        <div className="checklist" style={{ gap: 6 }}>
          <label>
            <input
              type="checkbox"
              checked={state.userWillSign}
              onChange={(e) => toggleUserWillSign(e.target.checked)}
            />
            <span>I will also sign this document</span>
          </label>
          {state.userWillSign && (
            <label>
              <input
                type="checkbox"
                checked={state.recipients.length === 0 && state.userWillSign && isOnlySigner}
                onChange={(e) => toggleOnlySigner(e.target.checked)}
              />
              <span>I am the only signer</span>
            </label>
          )}
        </div>

        {state.userWillSign && (
          <div className="field" style={{ marginTop: 'var(--space-3)' }}>
            <label htmlFor="user-display-name">
              Your name{' '}
              <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>
                (as it will appear on the document)
              </span>
            </label>
            <input
              id="user-display-name"
              type="text"
              value={state.userDisplayName || ''}
              onChange={handleDisplayNameChange}
              placeholder="Enter your name"
              style={
                validateAttempt && !state.userDisplayName?.trim() ? { borderColor: 'rgb(180, 60, 60)' } : undefined
              }
            />
            {validateAttempt && !state.userDisplayName?.trim() && (
              <span className="hint" style={{ color: 'rgb(180, 60, 60)' }}>
                Please enter your name
              </span>
            )}
          </div>
        )}
      </div>

      {/* B. Recipients list (hidden when "I am the only signer" is checked) */}
      {!(state.userWillSign && state.recipients.length === 0 && isOnlySigner) && (
        <section className="recipient-section" aria-labelledby="recipients-heading">
          <div className="recipient-section-head">
            <div>
              <h3 id="recipients-heading">Recipients</h3>
              <p>Add each signer, reviewer, or copied recipient individually.</p>
            </div>
            <button type="button" className="btn ghost sm" onClick={addRecipient}>
              <IconPlus /> Add recipient
            </button>
          </div>

          <div className="recipient-import">
            <div>
              <strong>Bulk resident import</strong>
              <span>CSV columns: name, email · up to 500 residents</span>
            </div>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" hidden onChange={importRecipientCsv} />
            <button type="button" className="btn ghost sm" onClick={() => csvInputRef.current?.click()}>
              Import CSV
            </button>
          </div>

          {csvStatus && (
            <Alert variant={csvStatus.startsWith('Could not') ? 'warn' : 'info'}>
              {csvStatus}
              {state.repaperingRecipients.length > 0 && (
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ marginLeft: 'var(--space-3)' }}
                  onClick={() => {
                    dispatch({ type: 'SET_REPAPERING_RECIPIENTS', payload: [] });
                    setCsvStatus('');
                  }}
                >
                  Clear batch
                </button>
              )}
            </Alert>
          )}

          {state.recipients.map((recipient) => {
            const isInvalidName = validateAttempt && recipient.name.trim() === '';
            const isInvalidEmail = validateAttempt && (recipient.email.trim() === '' || !isValidEmail(recipient.email));
            const isDuplicateSelf =
              state.userWillSign &&
              recipient.email.trim() !== '' &&
              session?.user?.email != null &&
              recipient.email.trim().toLowerCase() === session.user.email.toLowerCase();

            return (
              <div key={recipient.id}>
                <div className="recipient-row">
                  <input
                    ref={(el) => {
                      if (el) {
                        nameInputRefs.current[recipient.id] = el;
                      } else {
                        delete nameInputRefs.current[recipient.id];
                      }
                    }}
                    type="text"
                    placeholder="Recipient name"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(recipient.id, 'name', e.target.value)}
                    aria-label="Recipient name"
                    style={{
                      height: 38,
                      padding: '0 12px',
                      border: `1px solid ${isInvalidName ? 'rgb(180, 60, 60)' : 'var(--line)'}`,
                      borderRadius: 'var(--r-2)',
                      background: 'var(--surface)',
                      font: 'inherit',
                      color: 'var(--ink)',
                      outline: 'none',
                    }}
                  />
                  <input
                    ref={(el) => {
                      if (el) {
                        emailInputRefs.current[recipient.id] = el;
                      } else {
                        delete emailInputRefs.current[recipient.id];
                      }
                    }}
                    type="email"
                    placeholder="Email address"
                    value={recipient.email}
                    onChange={(e) => updateRecipient(recipient.id, 'email', e.target.value)}
                    aria-label="Recipient email"
                    style={{
                      height: 38,
                      padding: '0 12px',
                      border: `1px solid ${isInvalidEmail || isDuplicateSelf ? 'rgb(180, 60, 60)' : 'var(--line)'}`,
                      borderRadius: 'var(--r-2)',
                      background: 'var(--surface)',
                      font: 'inherit',
                      color: 'var(--ink)',
                      outline: 'none',
                    }}
                  />
                  <select
                    value={recipient.role}
                    onChange={(e) => updateRecipient(recipient.id, 'role', e.target.value)}
                    aria-label="Recipient role"
                    style={{
                      height: 38,
                      padding: '0 12px',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-2)',
                      background: 'var(--surface)',
                      font: 'inherit',
                      color: 'var(--ink)',
                    }}
                  >
                    <option value="signer">Signer</option>
                    <option value="viewer">Viewer</option>
                    <option value="cc">CC</option>
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeRecipient(recipient.id)}
                    aria-label="Remove recipient"
                  >
                    <IconTrashSmall />
                  </button>
                </div>
                {/* Per-recipient inline errors (rendered outside the grid) */}
                {(isInvalidName || isInvalidEmail || isDuplicateSelf) && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-3)',
                      marginTop: 4,
                      marginBottom: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <span style={{ flex: 1, color: 'rgb(180, 60, 60)' }}>
                      {isInvalidName ? 'Name is required' : ''}
                    </span>
                    <span style={{ flex: 1, color: isDuplicateSelf ? 'rgb(180, 120, 0)' : 'rgb(180, 60, 60)' }}>
                      {isDuplicateSelf
                        ? "This is your email. You're already added as a signer — please add a different recipient."
                        : isInvalidEmail
                          ? recipient.email.trim() === ''
                            ? 'Email is required'
                            : 'Invalid email format'
                          : ''}
                    </span>
                    {/* spacer for role + trash columns */}
                    <span style={{ width: 130 }} />
                    <span style={{ width: 32 }} />
                  </div>
                )}
              </div>
            );
          })}

          {state.recipients.length === 0 && (
            <div className="recipient-empty">
              <strong>No recipients yet</strong>
              <span>Add one recipient, or import a resident CSV to create a bulk signing run.</span>
            </div>
          )}
        </section>
      )}

      {/* C. Signing order block (only when multiple signers) */}
      {(state.recipients.length > 1 || (state.recipients.length >= 1 && state.userWillSign && !isOnlySigner)) && (
        <div>
          <div
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              color: 'var(--ink)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Signing order
          </div>
          <div className="radio-group">
            <label className={`radio-row ${state.signingOrder === 'parallel' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="order"
                checked={state.signingOrder === 'parallel'}
                onChange={() => setSigningOrder('parallel')}
              />
              <span className="radio-mark" />
              <div className="radio-body">
                <strong>Parallel</strong>
                <span>All recipients receive the document at once.</span>
              </div>
            </label>
            <label className={`radio-row ${state.signingOrder === 'sequential' ? 'checked' : ''}`}>
              <input
                type="radio"
                name="order"
                checked={state.signingOrder === 'sequential'}
                onChange={() => setSigningOrder('sequential')}
              />
              <span className="radio-mark" />
              <div className="radio-body">
                <strong>Sequential</strong>
                <span>One signer at a time, in the order listed above.</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* D. Duplicate-flow expiration field */}
      {state.duplicateAnnotations && (
        <div className="field">
          <label htmlFor="document-expiration">
            Document expiration date{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>(optional)</span>
          </label>
          <ReactDatePickerCustom
            id="document-expiration"
            date={state.document.expiresAt}
            setDate={(date: Date | undefined) => dispatch({ type: 'SET_DOCUMENT', payload: { expiresAt: date } })}
            placeholder="Set document expiration date"
            minDate={new Date()}
          />
          <span className="hint">
            <IconClock /> If set, the document cannot be signed after this date.
          </span>
        </div>
      )}

      {/* E. Validation error alert */}
      {validateAttempt && !validateRecipients() && (
        <Alert variant="warn">Please ensure all recipient information is filled correctly.</Alert>
      )}
    </div>
  );
}
