export type FinalizationMode = 'ELECTRONIC' | 'DIGITAL_SEAL';

export function parseFinalizationMode(value: unknown): FinalizationMode {
  return value === 'ELECTRONIC' ? 'ELECTRONIC' : 'DIGITAL_SEAL';
}

export function requiresDigitalSeal(mode: FinalizationMode): boolean {
  return mode === 'DIGITAL_SEAL';
}
