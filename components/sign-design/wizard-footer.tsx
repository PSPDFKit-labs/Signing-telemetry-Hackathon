import { IconArrowLeft, IconArrowRight } from './icons';

export function WizardFooter({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  backDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
}) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)' }}
    >
      <button
        type="button"
        className="btn ghost"
        disabled={backDisabled}
        onClick={onBack}
        style={{ opacity: backDisabled ? 0.4 : 1 }}
      >
        <IconArrowLeft /> Back
      </button>
      <button
        type="button"
        className="btn"
        disabled={nextDisabled}
        onClick={onNext}
        style={{ opacity: nextDisabled ? 0.4 : 1 }}
      >
        {nextLabel} <IconArrowRight />
      </button>
    </div>
  );
}
