'use client';

import { WizardFooter } from '@/components/sign-design/wizard-footer';

interface NavigationControlsProps {
  currentStep: number;
  totalSteps: number;
  canMoveForward: boolean;
  onNext: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

export default function NavigationControls({
  currentStep,
  totalSteps,
  canMoveForward,
  onNext,
  onBack,
  isSubmitting = false,
}: NavigationControlsProps) {
  const isLastStep = currentStep === totalSteps;

  // On the last step (Review & Send) the page renders its own send button,
  // so suppress the wizard footer's Next button by returning a back-only
  // footer. Re-using design-system WizardFooter requires both onBack and
  // onNext; we provide a no-op onNext and disable it.
  if (isLastStep) {
    return (
      <WizardFooter
        onBack={onBack}
        onNext={() => undefined}
        nextLabel="Send"
        nextDisabled
        backDisabled={isSubmitting}
      />
    );
  }

  return (
    <WizardFooter
      onBack={onBack}
      onNext={onNext}
      nextLabel="Next"
      nextDisabled={!canMoveForward || isSubmitting}
      backDisabled={currentStep === 1 || isSubmitting}
    />
  );
}
