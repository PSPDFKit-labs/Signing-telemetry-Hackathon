/**
 * Custom renderer for document preview (read-only mode)
 * Shows signature fields with completion status indicators
 * - Green checkmark for signed fields
 * - Orange clock for pending fields
 * - Red X for declined fields
 */

interface SignatureStatus {
  participantId: string;
  status: 'PENDING' | 'SIGNED' | 'DECLINED' | 'CANCELLED';
  participantName: string;
  participantEmail: string;
}

interface RendererOptions {
  signatureStatuses: SignatureStatus[];
}

// Color palette for different statuses
const STATUS_COLORS = {
  SIGNED: '#22c55e', // Green
  PENDING: '#f59e0b', // Amber/Orange
  DECLINED: '#ef4444', // Red
  CANCELLED: '#6b7280', // Gray
};

export function createPreviewFieldRenderer(options: RendererOptions) {
  return ({ annotation }: any) => {
    // Use formFieldName instead of name (name is the widget ID)
    const fieldName = annotation.formFieldName || annotation.name;

    // Skip if no field name or it's not one of our fields
    if (!fieldName || !['signature', 'initials', 'initial', 'date'].some((type) => fieldName.startsWith(type))) {
      return null;
    }

    // Get recipient info from customData
    const signerId = annotation.customData?.signerID || annotation.customData?.recipientId || '';
    const signerName = annotation.customData?.signerName || annotation.customData?.recipientName || 'Unknown';
    const signerEmail = annotation.customData?.signerEmail || annotation.customData?.recipientEmail || '';
    const fieldType = annotation.customData?.type || annotation.customData?.fieldType || 'signature';

    // Find signature status - primary method: match by signerID (participantId)
    let matchedStatus: SignatureStatus | undefined;

    // Primary: Match by signerID (now reliable after ID consistency fix)
    if (signerId) {
      matchedStatus = options.signatureStatuses.find((s) => s.participantId === signerId);
    }

    // Fallback: Match by email slug from field name (for legacy fields)
    if (!matchedStatus) {
      const parts = fieldName.split('_');
      const fieldEmailSlug = parts.length >= 2 ? parts[1].toLowerCase() : '';

      for (const status of options.signatureStatuses) {
        const statusEmailSlug = status.participantEmail.split('@')[0].toLowerCase().replace(/\./g, '');
        if (fieldEmailSlug === statusEmailSlug) {
          matchedStatus = status;
          break;
        }
      }
    }

    // Last fallback: Match by signerEmail from customData
    if (!matchedStatus && signerEmail) {
      matchedStatus = options.signatureStatuses.find(
        (s) => s.participantEmail.toLowerCase() === signerEmail.toLowerCase(),
      );
    }

    const signatureStatus = matchedStatus?.status || 'PENDING';
    const statusColor = STATUS_COLORS[signatureStatus] || STATUS_COLORS.PENDING;

    // Create a div to hold our custom field
    const div = document.createElement('div');
    div.className = 'preview-signature-field';

    // Base styling for preview mode
    div.style.cssText = `
      width: 100%;
      height: 100%;
      border: 2px solid ${statusColor};
      background-color: ${statusColor}15;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px;
      font-size: 11px;
      font-weight: 500;
      color: #666;
      user-select: none;
      pointer-events: none;
      position: relative;
    `;

    // Create status indicator (checkmark, clock, or X)
    const statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: ${statusColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
    `;

    // Set status icon
    if (signatureStatus === 'SIGNED') {
      statusIndicator.innerHTML = '&#10003;'; // Checkmark
      statusIndicator.title = 'Signed';
    } else if (signatureStatus === 'DECLINED') {
      statusIndicator.innerHTML = '&#10005;'; // X mark
      statusIndicator.title = 'Declined';
    } else if (signatureStatus === 'CANCELLED') {
      statusIndicator.innerHTML = '&#8213;'; // Dash
      statusIndicator.title = 'Cancelled';
    } else {
      statusIndicator.innerHTML = '&#9679;'; // Dot (pending)
      statusIndicator.title = 'Pending';
    }

    div.appendChild(statusIndicator);

    // Handle different field types
    if (fieldType === 'date') {
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'text-align: center; line-height: 1.2;';

      const signerText = document.createElement('div');
      signerText.style.cssText = 'font-size: 9px; color: #888; margin-bottom: 2px;';
      signerText.textContent = signerName;

      const dateText = document.createElement('div');
      dateText.style.cssText = 'font-size: 11px;';

      if (signatureStatus === 'SIGNED') {
        const signedDate = annotation.customData?.signedAt
          ? new Date(annotation.customData.signedAt).toLocaleDateString()
          : new Date().toLocaleDateString();
        dateText.textContent = signedDate;
        dateText.style.color = STATUS_COLORS.SIGNED;
      } else {
        dateText.textContent = 'mm/dd/yyyy';
        dateText.style.opacity = '0.6';
      }

      contentDiv.appendChild(signerText);
      contentDiv.appendChild(dateText);
      div.appendChild(contentDiv);
    } else {
      // For signature and initials fields
      const contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'text-align: center; line-height: 1.2;';

      let displayText = '';
      if (fieldType === 'initial' || fieldType === 'initials') {
        displayText = signerName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase();
      } else {
        displayText = signerName;
      }

      const nameText = document.createElement('div');
      nameText.style.cssText = 'font-size: 12px; font-weight: 600;';

      if (signatureStatus === 'SIGNED') {
        nameText.style.color = STATUS_COLORS.SIGNED;
        nameText.style.fontStyle = 'italic';
      } else {
        nameText.style.opacity = '0.7';
      }

      nameText.textContent = displayText;
      contentDiv.appendChild(nameText);

      // Add status text for non-signed fields
      if (signatureStatus !== 'SIGNED') {
        const statusText = document.createElement('div');
        statusText.style.cssText = 'font-size: 9px; margin-top: 2px; text-transform: capitalize;';
        statusText.style.color = statusColor;
        statusText.textContent = signatureStatus.toLowerCase();
        contentDiv.appendChild(statusText);
      }

      div.appendChild(contentDiv);
    }

    return {
      node: div,
      append: true,
    };
  };
}
