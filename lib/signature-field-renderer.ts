/**
 * Custom renderer for signature fields in Nutrient Viewer
 * Creates styled field overlays showing recipient names
 * Differentiates between current user's fields and other signers' fields
 */

interface Participant {
  id?: string;
  participantId?: string;
  name: string;
  email: string;
  role?: string;
}

interface RendererOptions {
  currentRecipientId: string;
  participants: Participant[];
}

// Color palette for different signers (matching FieldPlacement colors)
const SIGNER_COLORS = [
  '#4A90E2', // Blue
  '#E24A4A', // Red
  '#4AE290', // Green
  '#E2904A', // Orange
  '#904AE2', // Purple
  '#E2E24A', // Yellow
  '#4AE2E2', // Cyan
  '#E24AE2', // Magenta
];

export function createSignatureFieldRenderer(options: RendererOptions) {
  return ({ annotation }: any) => {
    // Use formFieldName instead of name (name is the widget ID)
    const fieldName = annotation.formFieldName || annotation.name;

    // Skip if no field name or it's not one of our fields
    if (!fieldName || !['signature', 'initials', 'initial', 'date'].some((type) => fieldName.startsWith(type))) {
      return null;
    }

    // Get recipient info from customData (using Nutrient convention: signerID, signerName, etc.)
    const signerId = annotation.customData?.signerID || annotation.customData?.recipientId;
    const signerName = annotation.customData?.signerName || annotation.customData?.recipientName || 'Unknown';
    const signerEmail = annotation.customData?.signerEmail || annotation.customData?.recipientEmail || '';
    const signerColor = annotation.customData?.signerColor || '#4A90E2';
    const fieldType = annotation.customData?.type || annotation.customData?.fieldType || 'signature';

    // Determine if this field belongs to the current recipient
    // Primary: Use signerId matching (now reliable after ID consistency fix)
    // Fallback: Use email slug matching from field name
    let isCurrentRecipient = false;

    // Primary method: signerId from customData matches currentRecipientId
    if (signerId && signerId === options.currentRecipientId) {
      isCurrentRecipient = true;
    } else if (!signerId || signerId === '') {
      // Fallback: email slug matching for legacy fields without signerId
      const currentParticipant = options.participants.find(
        (p) => p.id === options.currentRecipientId || p.participantId === options.currentRecipientId,
      );
      if (currentParticipant?.email) {
        const parts = fieldName.split('_');
        const fieldEmailSlug = parts.length >= 2 ? parts[1].toLowerCase() : '';
        const currentEmailSlug = currentParticipant.email.split('@')[0].toLowerCase().replace(/\./g, '');
        isCurrentRecipient = fieldEmailSlug === currentEmailSlug;
      }
    }

    // Determine color - use signerColor from customData if available, otherwise find by participant
    let displayColor = signerColor;
    if (!annotation.customData?.signerColor) {
      const participantIndex = options.participants.findIndex(
        (p) => p.id === signerId || p.participantId === signerId || p.email === signerEmail,
      );
      displayColor = participantIndex >= 0 ? SIGNER_COLORS[participantIndex % SIGNER_COLORS.length] : SIGNER_COLORS[0];
    }

    // Create a div to hold our custom field
    const div = document.createElement('div');
    div.className = `custom-signature-field ${isCurrentRecipient ? 'current-recipient-field' : 'other-recipient-field'}`;

    // Apply styling - different style for current recipient vs others
    if (isCurrentRecipient) {
      // Current recipient's fields - highlighted and interactive
      div.style.cssText = `
        width: 100%;
        height: 100%;
        border: 2px solid ${displayColor};
        background-color: ${displayColor}25;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4px;
        font-size: 12px;
        font-weight: 600;
        color: ${displayColor};
        cursor: pointer;
        user-select: none;
        pointer-events: none;
        box-shadow: 0 0 8px ${displayColor}40;
        position: relative;
        overflow: hidden;
      `;
    } else {
      // Other signers' fields - muted and read-only
      div.style.cssText = `
        width: 100%;
        height: 100%;
        border: 1px solid #ccc;
        background-color: #f5f5f5;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4px;
        font-size: 11px;
        font-weight: 500;
        color: #888;
        cursor: not-allowed;
        user-select: none;
        pointer-events: none;
        opacity: 0.6;
        position: relative;
        overflow: hidden;
      `;
    }

    // Add badge label ("Sign" or "Initial") for signature/initials fields
    if (fieldType !== 'date') {
      const badge = document.createElement('span');
      const isInitials = fieldType === 'initial' || fieldType === 'initials';
      badge.textContent = isInitials ? 'Initial' : 'Sign';
      badge.style.cssText = `
        position: absolute;
        top: 2px;
        left: 2px;
        max-width: calc(100% - 4px);
        overflow: hidden;
        text-overflow: ellipsis;
        background-color: ${isCurrentRecipient ? displayColor : '#888'};
        color: white;
        font-size: 7px;
        font-weight: 700;
        padding: 2px 3px;
        border-radius: 2px;
        line-height: 1;
        white-space: nowrap;
        display: inline-block;
        pointer-events: none;
        z-index: 1;
      `;
      div.appendChild(badge);
    }

    // Handle different field types
    if (fieldType === 'date') {
      // For date fields, show signer name + date placeholder, center text
      const signerNameText = document.createElement('div');
      signerNameText.style.cssText = 'text-align: center; line-height: 1.1; font-size: 10px; margin-bottom: 2px;';
      signerNameText.textContent = signerName;

      const dateText = document.createElement('div');
      dateText.style.cssText = 'text-align: center; line-height: 1.1; font-size: 11px; opacity: 0.8;';
      dateText.textContent = 'mm/dd/yyyy';

      div.appendChild(signerNameText);
      div.appendChild(dateText);
    } else {
      // For signature and initials fields
      const mainText = document.createElement('div');
      mainText.style.cssText = 'text-align: center; line-height: 1.2;';

      let displayText = '';
      if (fieldType === 'initial' || fieldType === 'initials') {
        // Show initials (first letter of each name part, uppercase)
        displayText = signerName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase();
      } else {
        // Signature - show full name
        displayText = signerName;
      }

      mainText.textContent = displayText;
      div.appendChild(mainText);
    }

    // Return the custom renderer configuration
    return {
      node: div,
      append: true,
    };
  };
}
