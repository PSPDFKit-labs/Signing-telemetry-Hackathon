export type Palette = 'warm' | 'cool' | 'mono' | 'forest';
export type TypePairing = 'editorial' | 'technical' | 'warm-sans';
export type Density = 'spacious' | 'balanced' | 'dense';
export type Radius = 'sharp' | 'soft' | 'round';

export type Tweaks = {
  palette: Palette;
  type: TypePairing;
  density: Density;
  radius: Radius;
  accent: string; // hex
  dark: boolean;
};

export const TWEAK_DEFAULTS: Tweaks = {
  palette: 'cool',
  type: 'technical',
  density: 'balanced',
  radius: 'soft',
  accent: '#5EC6C1',
  dark: false,
};

export const TWEAK_STORAGE_KEY = 'nutrient-sign:tweaks';
