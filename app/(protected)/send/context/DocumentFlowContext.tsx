'use client';

import { createContext, useContext, useReducer } from 'react';
import type { PacketManifest } from '@/lib/document-packets';

// Define the types for our document flow
export type Theme = 'dark' | 'light' | 'system';

export type RecipientRole = 'signer' | 'viewer' | 'cc';

export type FieldType = 'signature' | 'initial' | 'name' | 'email' | 'date' | 'text' | 'checkbox' | 'dropdown';

export type Document = {
  id?: string; // Database document ID after saving
  title: string;
  file?: File;
  url?: string;
  templateId?: string;
  saveAsTemplate: boolean;
  templateName?: string; // Name if saving as template
  fileSize?: number; // Size in bytes
  expiresAt?: Date; // Optional document expiration date
  packetManifest?: PacketManifest;
  finalizationMode: 'ELECTRONIC' | 'DIGITAL_SEAL';
  signingMethod: 'ELECTRONIC' | 'WET';
};

export type Recipient = {
  id: string;
  name: string;
  email: string;
  role: RecipientRole;
  signingOrder: number;
};

export type Field = {
  id: string;
  type: FieldType;
  recipientId: string;
  position: { x: number; y: number; page: number };
  size: { width: number; height: number };
  required: boolean;
  label?: string;
  validationRules?: any;
};

export type Email = {
  subject: string;
  message: string;
};

export type StepValidation = {
  step1Valid: boolean;
  step2Valid: boolean;
  step3Valid: boolean;
  step4Valid: boolean;
  step5Valid: boolean;
};

// State type definition
export type DocumentFlowState = {
  currentStep: number;
  totalSteps: number;
  document: Document;
  recipients: Array<Recipient>;
  fields: Array<Field>;
  email: Email;
  stepValidation: StepValidation;
  userWillSign: boolean;
  signingOrder: 'sequential' | 'parallel';
  userDisplayName: string | null;
  ownerParticipantId: string; // Stable ID for owner when they're also a signer
  duplicateAnnotations?: any; // Original InstantJSON for field recreation
  repaperingRecipients: Array<Recipient>;
  repaperingBatchId: string;
};

// Action type definitions
export type DocumentFlowAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_DOCUMENT'; payload: Partial<Document> }
  | { type: 'SET_DOCUMENT_ID'; payload: string }
  | { type: 'ADD_RECIPIENT'; payload: Recipient }
  | { type: 'SET_RECIPIENTS'; payload: Array<Recipient> }
  | { type: 'SET_REPAPERING_RECIPIENTS'; payload: Array<Recipient> }
  | {
      type: 'UPDATE_RECIPIENT';
      payload: { id: string; data: Partial<Recipient> };
    }
  | { type: 'REMOVE_RECIPIENT'; payload: { id: string } }
  | { type: 'ADD_FIELD'; payload: Field }
  | { type: 'UPDATE_FIELD'; payload: { id: string; data: Partial<Field> } }
  | { type: 'REMOVE_FIELD'; payload: { id: string } }
  | { type: 'SET_FIELDS'; payload: Array<Field> }
  | { type: 'SET_EMAIL'; payload: Partial<Email> }
  | { type: 'SET_USER_WILL_SIGN'; payload: boolean }
  | { type: 'SET_SIGNING_ORDER'; payload: 'sequential' | 'parallel' }
  | { type: 'SET_USER_DISPLAY_NAME'; payload: string | null }
  | {
      type: 'VALIDATE_STEP';
      payload: { step: keyof StepValidation; isValid: boolean };
    }
  | {
      type: 'HYDRATE_FROM_DUPLICATE';
      payload: {
        document: {
          id: string;
          title: string;
          url: string;
          fileSize?: number;
          expiresAt?: Date;
          finalizationMode?: 'ELECTRONIC' | 'DIGITAL_SEAL';
          signingMethod?: 'ELECTRONIC' | 'WET';
        };
        recipients: Array<Recipient>;
        signingOrder: 'sequential' | 'parallel';
        userWillSign: boolean;
        userDisplayName: string | null;
        ownerParticipantId?: string;
        duplicateAnnotations?: any;
      };
    };

// Initial state factory - generates a new state with unique ownerParticipantId
const createInitialState = (): DocumentFlowState => ({
  currentStep: 1,
  totalSteps: 5,
  document: {
    title: '',
    saveAsTemplate: false,
    finalizationMode: 'DIGITAL_SEAL',
    signingMethod: 'ELECTRONIC',
  },
  recipients: [],
  fields: [],
  email: {
    subject: 'Please sign this document',
    message: 'I have sent you a document to sign. Please review and sign at your earliest convenience.',
  },
  stepValidation: {
    step1Valid: false,
    step2Valid: false,
    step3Valid: false,
    step4Valid: true, // Email step starts valid since we provide defaults
    step5Valid: true,
  },
  userWillSign: false,
  signingOrder: 'parallel',
  userDisplayName: null,
  ownerParticipantId: crypto.randomUUID(), // Stable ID for owner when they're also a signer
  repaperingRecipients: [],
  repaperingBatchId: crypto.randomUUID(),
});

// Static initial state for context default (won't actually be used due to lazy init)
export const initialState: DocumentFlowState = {
  currentStep: 1,
  totalSteps: 5,
  document: {
    title: '',
    saveAsTemplate: false,
    finalizationMode: 'DIGITAL_SEAL',
    signingMethod: 'ELECTRONIC',
  },
  recipients: [],
  fields: [],
  email: {
    subject: 'Please sign this document',
    message: 'I have sent you a document to sign. Please review and sign at your earliest convenience.',
  },
  stepValidation: {
    step1Valid: false,
    step2Valid: false,
    step3Valid: false,
    step4Valid: true,
    step5Valid: true,
  },
  userWillSign: false,
  signingOrder: 'parallel',
  userDisplayName: null,
  ownerParticipantId: '', // Placeholder - actual value generated in provider
  repaperingRecipients: [],
  repaperingBatchId: '',
};

// Reducer function
export const documentFlowReducer = (state: DocumentFlowState, action: DocumentFlowAction): DocumentFlowState => {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'SET_DOCUMENT':
      return {
        ...state,
        document: {
          ...state.document,
          ...action.payload,
        },
      };

    case 'SET_DOCUMENT_ID':
      return {
        ...state,
        document: {
          ...state.document,
          id: action.payload,
        },
      };

    case 'ADD_RECIPIENT':
      return {
        ...state,
        recipients: [...state.recipients, action.payload],
      };

    case 'SET_RECIPIENTS':
      return {
        ...state,
        recipients: action.payload,
      };

    case 'SET_REPAPERING_RECIPIENTS':
      return {
        ...state,
        repaperingRecipients: action.payload,
      };

    case 'UPDATE_RECIPIENT':
      return {
        ...state,
        recipients: state.recipients.map((recipient) =>
          recipient.id === action.payload.id ? { ...recipient, ...action.payload.data } : recipient,
        ),
      };

    case 'REMOVE_RECIPIENT':
      return {
        ...state,
        recipients: state.recipients.filter((recipient) => recipient.id !== action.payload.id),
        // Also remove fields associated with this recipient
        fields: state.fields.filter((field) => field.recipientId !== action.payload.id),
      };

    case 'ADD_FIELD':
      return {
        ...state,
        fields: [...state.fields, action.payload],
      };

    case 'UPDATE_FIELD':
      return {
        ...state,
        fields: state.fields.map((field) =>
          field.id === action.payload.id ? { ...field, ...action.payload.data } : field,
        ),
      };

    case 'REMOVE_FIELD':
      return {
        ...state,
        fields: state.fields.filter((field) => field.id !== action.payload.id),
      };

    case 'SET_FIELDS':
      return {
        ...state,
        fields: action.payload,
      };

    case 'SET_EMAIL':
      return {
        ...state,
        email: {
          ...state.email,
          ...action.payload,
        },
      };

    case 'SET_USER_WILL_SIGN':
      return {
        ...state,
        userWillSign: action.payload,
      };

    case 'SET_SIGNING_ORDER':
      return {
        ...state,
        signingOrder: action.payload,
      };

    case 'SET_USER_DISPLAY_NAME':
      return {
        ...state,
        userDisplayName: action.payload,
      };

    case 'VALIDATE_STEP':
      return {
        ...state,
        stepValidation: {
          ...state.stepValidation,
          [action.payload.step]: action.payload.isValid,
        },
      };

    case 'HYDRATE_FROM_DUPLICATE':
      return {
        ...state,
        currentStep: 2,
        document: {
          ...state.document,
          id: action.payload.document.id,
          title: action.payload.document.title,
          url: action.payload.document.url,
          fileSize: action.payload.document.fileSize,
          expiresAt: action.payload.document.expiresAt,
          saveAsTemplate: false,
          finalizationMode: action.payload.document.finalizationMode || state.document.finalizationMode,
          signingMethod: action.payload.document.signingMethod || state.document.signingMethod,
        },
        recipients: action.payload.recipients,
        signingOrder: action.payload.signingOrder,
        userWillSign: action.payload.userWillSign,
        userDisplayName: action.payload.userDisplayName,
        ownerParticipantId: action.payload.ownerParticipantId || state.ownerParticipantId,
        duplicateAnnotations: action.payload.duplicateAnnotations,
        stepValidation: {
          ...state.stepValidation,
          step1Valid: true,
        },
      };

    default:
      return state;
  }
};

// Create the context
export const DocumentFlowContext = createContext<{
  state: DocumentFlowState;
  dispatch: React.Dispatch<DocumentFlowAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

// Provider component
export function DocumentFlowProvider({ children }: { children: React.ReactNode }) {
  // Use lazy initialization to generate unique ownerParticipantId per session
  const [state, dispatch] = useReducer(documentFlowReducer, null, createInitialState);

  return <DocumentFlowContext.Provider value={{ state, dispatch }}>{children}</DocumentFlowContext.Provider>;
}

// Custom hook to use the DocumentFlow context
export function useDocumentFlow() {
  const context = useContext(DocumentFlowContext);
  if (!context) {
    throw new Error('useDocumentFlow must be used within a DocumentFlowProvider');
  }
  return context;
}
