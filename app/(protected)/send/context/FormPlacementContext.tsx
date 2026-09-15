// This file provides context for the field placement functionality
// with support for recipient navigation and field assignment

import { useSession } from 'next-auth/react';
import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { FIELD_SPECS } from '../components/steps/field-placement/field-specs';
import type { Recipient } from './DocumentFlowContext';

type FieldCounts = Record<string, number>;

const emptyFieldCounts = (): FieldCounts => Object.fromEntries(FIELD_SPECS.map((spec) => [spec.type, 0]));

interface FormPlacementContextType {
  formPlacementMode: boolean;
  setFormPlacementMode: React.Dispatch<React.SetStateAction<boolean>>;
  currentRecipient: Recipient | null;
  currentRecipientIndex: number;
  setCurrentRecipientIndex: React.Dispatch<React.SetStateAction<number>>;
  signerRecipients: Recipient[];
  goToNextRecipient: () => void;
  goToPreviousRecipient: () => void;
  recipientColors: { [email: string]: string };

  // New field tracking properties
  recipientFieldCounts: {
    [email: string]: FieldCounts;
  };
  updateFieldCount: (recipientEmail: string, fieldType: string, increment: boolean) => void;

  // New validation properties
  allSignersHaveSignatures: boolean;
  signersWithoutSignatures: string[]; // Emails of signers who still need signatures
  recipientHasSignature: (email: string) => boolean;

  // Owner participant ID for field matching
  ownerParticipantId: string | null;

  // Direct field creation callback (for touch/click on tablet/mobile)
  onCreateField?: (fieldType: string) => void;
}

// Create the context with default values
export const FormPlacementContext = createContext<FormPlacementContextType>({
  formPlacementMode: false,
  setFormPlacementMode: () => {},
  currentRecipient: null,
  currentRecipientIndex: 0,
  setCurrentRecipientIndex: () => {},
  signerRecipients: [],
  goToNextRecipient: () => {},
  goToPreviousRecipient: () => {},
  recipientColors: {},
  recipientFieldCounts: {},
  updateFieldCount: () => {},
  allSignersHaveSignatures: false,
  signersWithoutSignatures: [],
  recipientHasSignature: () => false,
  ownerParticipantId: null,
  onCreateField: undefined,
});

// A hook to use the form placement context
export const useFormPlacement = () => useContext(FormPlacementContext);

// Provider component that wraps parts of the app that need the context
export const FormPlacementProvider: React.FC<{
  children: React.ReactNode;
  recipients: Recipient[];
  userWillSign?: boolean;
  userDisplayName?: string;
  userEmail?: string;
  ownerParticipantId?: string; // Passed from DocumentFlowContext for consistency
  onCreateField?: (fieldType: string) => void;
}> = ({
  children,
  recipients,
  userWillSign = false,
  userDisplayName,
  userEmail,
  ownerParticipantId: ownerIdProp,
  onCreateField,
}) => {
  const { data: session } = useSession();
  const [formPlacementMode, setFormPlacementMode] = useState(false);
  const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);

  // Use the passed ownerParticipantId or generate a fallback (for backwards compatibility)
  const [fallbackOwnerId] = useState<string>(() => crypto.randomUUID());
  const ownerParticipantId = ownerIdProp || fallbackOwnerId;

  // New state for tracking field counts per recipient
  const [recipientFieldCounts, setRecipientFieldCounts] = useState<{
    [email: string]: FieldCounts;
  }>({});

  // Determine current user info - prefer passed props, fallback to session
  const currentUserEmail = userEmail || session?.user?.email;
  const currentUserName = userDisplayName || session?.user?.name || 'Me (Current User)';

  // Filter signer recipients and add current user if they will sign
  const signerRecipients = useMemo(
    () => [
      ...(userWillSign && currentUserEmail
        ? [
            {
              id: ownerParticipantId, // Use stable ID for field matching
              email: currentUserEmail,
              name: currentUserName,
              role: 'signer',
              signingOrder: 0, // Will be calculated properly when saving
            } as Recipient,
          ]
        : []),
      ...recipients.filter((r) => r.role === 'signer'),
    ],
    [userWillSign, currentUserEmail, currentUserName, recipients, ownerParticipantId],
  );

  // Get current recipient
  const currentRecipient = signerRecipients.length > 0 ? signerRecipients[currentRecipientIndex] : null;

  // Generate a unique color for each recipient
  const recipientColors = signerRecipients.reduce(
    (acc, recipient, index) => {
      const hue = (index * 137.5) % 360; // Generate evenly spaced hues
      acc[recipient.email] = `hsl(${hue}, 70%, 85%)`; // Solid colors for better visibility
      return acc;
    },
    {} as { [email: string]: string },
  );

  // Navigation functions
  const goToNextRecipient = () => {
    setCurrentRecipientIndex((prev) => (prev < signerRecipients.length - 1 ? prev + 1 : prev));
  };

  const goToPreviousRecipient = () => {
    setCurrentRecipientIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  // Update field counts for a recipient
  const updateFieldCount = useCallback((email: string, fieldType: string, increment: boolean) => {
    setRecipientFieldCounts((prev) => {
      // Get current counts or initialize with zeros
      const currentCounts = prev[email] || emptyFieldCounts();

      // Make sure we never go below zero
      const newCount = Math.max(0, (currentCounts[fieldType] ?? 0) + (increment ? 1 : -1));

      return {
        ...prev,
        [email]: {
          ...currentCounts,
          [fieldType]: newCount,
        },
      };
    });
  }, []);

  // Computed validation properties
  const allSignersHaveSignatures = useMemo(() => {
    return signerRecipients.every((recipient) => (recipientFieldCounts[recipient.email]?.signature || 0) > 0);
  }, [signerRecipients, recipientFieldCounts]);

  const signersWithoutSignatures = useMemo(() => {
    return signerRecipients
      .filter((recipient) => (recipientFieldCounts[recipient.email]?.signature || 0) === 0)
      .map((recipient) => recipient.email);
  }, [signerRecipients, recipientFieldCounts]);

  // Helper function to check if a recipient has a signature
  const recipientHasSignature = useCallback(
    (email: string) => {
      return (recipientFieldCounts[email]?.signature || 0) > 0;
    },
    [recipientFieldCounts],
  );

  // Value object passed to consumers
  const value = {
    formPlacementMode,
    setFormPlacementMode,
    currentRecipient,
    currentRecipientIndex,
    setCurrentRecipientIndex,
    signerRecipients,
    goToNextRecipient,
    goToPreviousRecipient,
    recipientColors,
    recipientFieldCounts,
    updateFieldCount,
    allSignersHaveSignatures,
    signersWithoutSignatures,
    recipientHasSignature,
    ownerParticipantId: userWillSign ? ownerParticipantId : null,
    onCreateField,
  };

  return <FormPlacementContext.Provider value={value}>{children}</FormPlacementContext.Provider>;
};
