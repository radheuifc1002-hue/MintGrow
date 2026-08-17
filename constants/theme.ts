// MintGrow Game Theme
export const Colors = {
  // Brand
  primary: '#00D4AA',
  primaryDark: '#00A882',
  primaryGlow: 'rgba(0, 212, 170, 0.3)',
  accent: '#FFD700',
  accentGlow: 'rgba(255, 215, 0, 0.3)',

  // Backgrounds
  bg: '#0A0F1E',
  bgCard: '#111827',
  bgSurface: '#1A2235',
  bgElevated: '#1F2D45',
  bgModal: 'rgba(10,15,30,0.95)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8FA3BF',
  textMuted: '#4A6080',
  textAccent: '#00D4AA',

  // Semantic
  success: '#00D4AA',
  error: '#FF4757',
  warning: '#FFD700',
  info: '#4FC3F7',

  // Borders
  border: '#1E3050',
  borderGlow: 'rgba(0,212,170,0.4)',

  // Tiles
  tile2: '#1A2235',
  tile4: '#1E3050',
  tile8: '#0D4F4F',
  tile16: '#1A5C2A',
  tile32: '#4A3500',
  tile64: '#4A0D1A',
  tile128: '#2D0A4E',
  tile256: '#0A2E6E',
  tile512: '#00D4AA',
  tile1024: '#FFD700',
  tileBomb: '#FF4757',
  tileBlocker: '#333',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  smallBold: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
};

// Coin tile data
export const COIN_TILES = [
  { value: 2, symbol: 'BTC', emoji: '₿', color: '#F7931A', bg: '#2D1F0A' },
  { value: 4, symbol: 'ETH', emoji: 'Ξ', color: '#627EEA', bg: '#0F1A3D' },
  { value: 8, symbol: 'BNB', emoji: '◈', color: '#F3BA2F', bg: '#2D2010' },
  { value: 16, symbol: 'SOL', emoji: '◎', color: '#9945FF', bg: '#1A0A2D' },
  { value: 32, symbol: 'DOGE', emoji: 'Ð', color: '#C2A633', bg: '#2D2610' },
  { value: 64, symbol: 'PEPE', emoji: '🐸', color: '#00AA44', bg: '#0A1F0F' },
  { value: 128, symbol: 'SHIB', emoji: '🐕', color: '#FF6D00', bg: '#2D1500' },
  { value: 256, symbol: 'FLOKI', emoji: '⚡', color: '#FF9800', bg: '#2D1C00' },
  { value: 512, symbol: 'BONK', emoji: '🦴', color: '#FF4081', bg: '#2D0A18' },
  { value: 1024, symbol: 'WIF', emoji: '🎩', color: '#00BCD4', bg: '#002D33' },
  { value: 2048, symbol: 'MG', emoji: '✦', color: '#00D4AA', bg: '#003D30' },
];

export const getCoinForValue = (value: number) => {
  return COIN_TILES.find(c => c.value === value) || COIN_TILES[COIN_TILES.length - 1];
};
