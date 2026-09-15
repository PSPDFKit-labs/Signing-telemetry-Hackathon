'use client';

import { StepIndicator as SignDesignStepIndicator } from '@/components/sign-design/step-indicator';

const STEP_LABELS = ['Document', 'Recipients', 'Fields', 'Message', 'Review'];

interface StepIndicatorProps {
  currentStep: number; // 1-indexed (1 = first step)
  totalSteps: number; // typically 5
  steps?: string[];
}

export default function StepIndicator({ currentStep, totalSteps, steps }: StepIndicatorProps) {
  // Design-system StepIndicator is 0-indexed. Normalize.
  const stepLabels = steps ?? STEP_LABELS.slice(0, totalSteps);
  return <SignDesignStepIndicator step={Math.max(0, currentStep - 1)} steps={stepLabels} />;
}
