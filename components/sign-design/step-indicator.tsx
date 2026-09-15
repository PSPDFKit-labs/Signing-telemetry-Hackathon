import { IconCheck } from './icons';

export function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <div className={`step-line${i <= step ? ' done' : ''}`} />}
          <div className={`step${i === step ? ' active' : i < step ? ' done' : ''}`}>
            <div className="step-dot">{i < step ? <IconCheck /> : i + 1}</div>
            <div className="step-label">{label}</div>
          </div>
        </span>
      ))}
    </div>
  );
}
