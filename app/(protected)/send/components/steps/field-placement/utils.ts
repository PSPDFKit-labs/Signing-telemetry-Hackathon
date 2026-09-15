// Utility functions extracted from FieldPlacement.tsx to eliminate duplication

import { getFieldPrefill, getFieldSpec, isPlaceableFieldType } from './field-specs';

/**
 * Creates a consistent, unique field name that includes a sanitized recipient identifier.
 */
export function createFieldName(fieldType: string, currentRecipient?: any): string {
  // Always include the recipient identifier in the field name to ensure correct assignment
  // Sanitize the email to remove dots and special characters that can cause issues
  const recipientEmail = currentRecipient?.email || 'unknown';
  const recipientId = recipientEmail
    .split('@')[0]
    .replace(/\./g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return `${fieldType}_${recipientId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

/**
 * Builds the widget annotation config object with customData for recipient info.
 * For date fields, adds border color and date formatting actions.
 */
export function buildWidgetConfig(
  runtime: any,
  opts: {
    boundingBox: any;
    fieldName: string;
    pageIndex: number;
    fieldType: string;
    recipient?: any;
  },
): any {
  const { boundingBox, fieldName, pageIndex, fieldType, recipient } = opts;
  const spec = getFieldSpec(fieldType);

  const config: any = {
    boundingBox,
    formFieldName: fieldName,
    id: runtime.generateInstantId(),
    pageIndex,
    name: fieldName,
    customData: {
      recipientId: recipient?.id || recipient?.participantId || '',
      recipientName: recipient?.name || 'Unknown',
      recipientEmail: recipient?.email || '',
      recipientColor: recipient?.color || '#4A90E2',
      type: fieldType,
      // Also add Nutrient-style naming for compatibility
      signerID: recipient?.id || recipient?.participantId || '',
      signerName: recipient?.name || 'Unknown',
      signerEmail: recipient?.email || '',
      signerColor: recipient?.color || '#4A90E2',
    },
  };

  // Add border and date formatting for date fields
  if (fieldType === 'date' && runtime.Color && runtime.Actions?.JavaScriptAction) {
    config.borderColor = runtime.Color.fromHex(recipient?.color || '#4A90E2');
    config.borderWidth = 2;
    config.additionalActions = {
      onFormat: new runtime.Actions.JavaScriptAction({
        script: 'AFDate_FormatEx("mm/dd/yyyy")',
      }),
    };
  }

  if (spec?.kind === 'data') {
    config.fontSize = 12;
    config.verticalAlign = 'center';
  }

  return config;
}

/**
 * Builds a form field (SignatureFormField or TextFormField) based on field type.
 * Returns null for unrecognized field types.
 */
export function buildFormField(
  runtime: any,
  fieldType: string,
  widgetId: string,
  fieldName: string,
  recipient?: { name?: string; email?: string },
): any {
  if (fieldType === 'signature') {
    return new runtime.FormFields.SignatureFormField({
      annotationIds: new runtime.Immutable.List([widgetId]),
      name: fieldName,
    });
  }
  if (fieldType === 'initials') {
    return new runtime.FormFields.SignatureFormField({
      annotationIds: new runtime.Immutable.List([widgetId]),
      name: fieldName,
      type: 'INITIALS',
    });
  }
  if (fieldType === 'checkbox') {
    return new runtime.FormFields.CheckBoxFormField({
      annotationIds: new runtime.Immutable.List([widgetId]),
      name: fieldName,
      options: new runtime.Immutable.List([new runtime.FormOption({ label: 'Yes', value: 'Yes' })]),
      defaultValues: new runtime.Immutable.List([]),
    });
  }
  if (['name', 'email', 'date', 'text'].includes(fieldType)) {
    return new runtime.FormFields.TextFormField({
      annotationIds: new runtime.Immutable.List([widgetId]),
      name: fieldName,
      defaultValue: getFieldPrefill(fieldType, recipient),
    });
  }
  return null;
}

/**
 * Sets the viewer to FORM_CREATOR interaction mode if available.
 */
export function setFormCreatorMode(instance: any, runtime: any): void {
  instance.setViewState((viewState: any) => {
    if (runtime?.InteractionMode?.FORM_CREATOR) {
      return viewState.set('interactionMode', runtime.InteractionMode.FORM_CREATOR);
    }
    return viewState;
  });
}

/**
 * Custom renderer factory for fields with recipient names and improved visual differentiation.
 */
export const getAnnotationRenderers =
  (_runtime: any, currentRecipient: any, recipientColors: { [email: string]: string }, signerRecipients: any[] = []) =>
  ({ annotation }: any) => {
    // Skip if no annotation name or it's not one of our fields
    const annotationType = annotation.customData?.type || annotation.name?.split('_')[0];
    if (!annotation.name || !annotationType || !isPlaceableFieldType(annotationType)) {
      return null;
    }

    // Extract recipient from field name or use current recipient
    let recipientName = currentRecipient?.name || 'Unknown';
    let recipientEmail = currentRecipient?.email || '';

    // Try to extract recipient from field name (for fields created by other recipients)
    const nameParts = annotation.name.split('_');

    // The recipient identifier might be in the second part of the field name
    // Let's check if we have enough parts and try to extract the recipient info
    if (nameParts.length >= 2) {
      const fieldRecipient = nameParts[1];
      // First try to find an exact match for the email username
      let matchingRecipient = signerRecipients.find((r) => r.email.split('@')[0] === fieldRecipient);

      // If no exact match, try other matching methods
      if (!matchingRecipient) {
        matchingRecipient = signerRecipients.find(
          (r) =>
            r.email.includes(fieldRecipient) || // Email contains the identifier
            r.name.toLowerCase().includes(fieldRecipient.toLowerCase()) || // Name contains the identifier
            fieldRecipient.includes(r.email.split('@')[0]), // Identifier contains email username
        );
      }

      // If we found a matching recipient, use their information instead of current recipient
      if (matchingRecipient) {
        recipientName = matchingRecipient.name;
        recipientEmail = matchingRecipient.email;
      } else {
      }
    } else {
    }

    // Create a div to hold our custom field (matching simple-signing-demo style)
    const div = document.createElement('div');
    div.className = 'custom-signature-field unsigned-field';

    // Get recipient's color or use default
    const signerColor = recipientEmail && recipientColors[recipientEmail] ? recipientColors[recipientEmail] : '#4A90E2'; // Default blue

    // Determine field type from annotation name
    const fieldType = annotationType;
    const spec = getFieldSpec(fieldType);

    // Apply styling matching simple-signing-demo
    div.style.cssText = `
      width: 100%;
      height: 100%;
      border: 2px solid ${signerColor};
      background-color: ${signerColor}15;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 14px;
      font-weight: 500;
      color: ${spec?.kind === 'data' ? '#666' : '#333'};
      cursor: pointer;
      user-select: none;
      pointer-events: none;
    `;

    // Display text based on field type
    let displayText = '';
    if (fieldType === 'initials') {
      // Show initials (first letter of each name part, uppercase)
      displayText = recipientName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase();
    } else if (fieldType === 'date') {
      displayText = 'mm/dd/yyyy'; // Show date format placeholder
    } else if (fieldType === 'name') {
      displayText = recipientName;
    } else if (fieldType === 'email') {
      displayText = recipientEmail;
    } else if (fieldType === 'text') {
      displayText = spec?.placeholder ?? 'Text';
    } else if (fieldType === 'checkbox') {
      displayText = '';
    } else {
      // Signature - show full name
      displayText = recipientName;
    }

    div.textContent = displayText;

    // Return the custom renderer configuration
    return {
      node: div,
      append: true,
    };
  };

export function getInitials(name: string | undefined | null): string {
  if (!name) return 'AB';
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || 'AB';
}
