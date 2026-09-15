import type * as NutrientViewerSDK from '@nutrient-sdk/viewer';
import type React from 'react';

export type NutrientViewerInstance = NutrientViewerSDK.Instance;

export interface FieldOptionProps {
  icon: React.ReactNode;
  label: string;
  type: string;
  compact?: boolean;
}

export interface FieldPlacement {
  type: string;
  position: string;
  name: string;
  recipient?: string;
  pageIndex?: number;
  coordinates?: { x: number; y: number };
  id?: string;
  width?: number;
  height?: number;
}

export interface DocumentState {
  url?: string;
}

export interface DocumentFlowState {
  document: DocumentState;
}

/** Recipient shape used throughout field placement */
export interface FieldRecipient {
  id?: string;
  participantId?: string;
  name: string;
  email: string;
  color?: string;
}
