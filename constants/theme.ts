// MintGrow Game Theme — White & Green
export const Colors = {
  // Brand
  primary: '#00A86B',         // Deep mint green
  primaryDark: '#007A4D',
  primaryLight: '#00D084',
  primaryGlow: 'rgba(0,168,107,0.12)',
  accent: '#00C853',
  accentGlow: 'rgba(0,200,83,0.15)',
  secondaryGreen: '#E8F5E9',

  // Backgrounds
  bg: '#F5FBF7',              // Near-white with green tint
  bgCard: '#FFFFFF',
  bgSurface: '#EFF8F2',
  bgElevated: '#FFFFFF',
  bgModal: 'rgba(245,251,247,0.97)',

  // Text
  textPrimary: '#0A2E1F',     // Very dark green
  textSecondary: '#2D5A3D',
  textMuted: '#7DA890',
  textAccent: '#00A86B',
  textOnGreen: '#FFFFFF',

  // Semantic
  success: '#00A86B',
  error: '#D32F2F',
  warning: '#F57F17',
  info: '#0277BD',

  // Borders
  border: '#C8E6C9',
  borderStrong: '#81C784',
  borderGlow: 'rgba(0,168,107,0.35)',

  // Tile backgrounds (updated for light theme — coins stay vibrant)
  tile2:    '#FFF8E1',
  tile4:    '#E8EAF6',
  tile8:    '#FFF3E0',
  tile16:   '#F3E5F5',
  tile32:   '#FFFDE7',
  tile64:   '#E8F5E9',
  tile128:  '#FBE9E7',
  tile256:  '#E3F2FD',
  tile512:  '#F9FBE7',
  tile1024: '#FFF8E1',
  tileBomb: '#FFEBEE',
  tileBlocker: '#ECEFF1',
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

// Extended coin tiles — BTC(2) → MintGrow(1B+)
export const COIN_TILES = [
  { value: 2,          symbol: 'BTC',   emoji: '₿',  color: '#F7931A', bg: '#FFF8E1' },
  { value: 4,          symbol: 'ETH',   emoji: 'Ξ',  color: '#627EEA', bg: '#E8EAF6' },
  { value: 8,          symbol: 'BNB',   emoji: '◈',  color: '#D4A017', bg: '#FFF9E0' },
  { value: 16,         symbol: 'SOL',   emoji: '◎',  color: '#9945FF', bg: '#F3E5F5' },
  { value: 32,         symbol: 'DOGE',  emoji: 'Ð',  color: '#C8A000', bg: '#FFFDE7' },
  { value: 64,         symbol: 'PEPE',  emoji: '🐸', color: '#00AA44', bg: '#E8F5E9' },
  { value: 128,        symbol: 'SHIB',  emoji: '🐕', color: '#E55000', bg: '#FBE9E7' },
  { value: 256,        symbol: 'AVAX',  emoji: '🔺', color: '#E84142', bg: '#FFEBEE' },
  { value: 512,        symbol: 'LINK',  emoji: '⬡',  color: '#2A5ADA', bg: '#E3F2FD' },
  { value: 1024,       symbol: 'MATIC', emoji: '⬟',  color: '#8247E5', bg: '#EDE7F6' },
  { value: 2048,       symbol: 'DOT',   emoji: '●',  color: '#E6007A', bg: '#FCE4EC' },
  { value: 4096,       symbol: 'ADA',   emoji: '₳',  color: '#0033AD', bg: '#E3F2FD' },
  { value: 8192,       symbol: 'TRX',   emoji: '🔷', color: '#FF0013', bg: '#FFEBEE' },
  { value: 16384,      symbol: 'LTC',   emoji: 'Ł',  color: '#BFBBBB', bg: '#F5F5F5' },
  { value: 32768,      symbol: 'ATOM',  emoji: '⚛',  color: '#6F4E7C', bg: '#F3E5F5' },
  { value: 65536,      symbol: 'NEAR',  emoji: '⬥',  color: '#000000', bg: '#ECEFF1' },
  { value: 131072,     symbol: 'FTM',   emoji: '⚡', color: '#1969FF', bg: '#E3F2FD' },
  { value: 262144,     symbol: 'SAND',  emoji: '🏖', color: '#04ADEF', bg: '#E1F5FE' },
  { value: 524288,     symbol: 'MANA',  emoji: '🌐', color: '#FF2D55', bg: '#FCE4EC' },
  { value: 1048576,    symbol: 'APE',   emoji: '🦍', color: '#0066FF', bg: '#E3F2FD' },
  { value: 2097152,    symbol: 'BONK',  emoji: '🦴', color: '#FF6B35', bg: '#FFF3E0' },
  { value: 4194304,    symbol: 'WIF',   emoji: '🎩', color: '#9C27B0', bg: '#F3E5F5' },
  { value: 8388608,    symbol: 'FLOKI', emoji: '⚡', color: '#FFA500', bg: '#FFF8E1' },
  { value: 16777216,   symbol: 'BRETT', emoji: '🎭', color: '#2196F3', bg: '#E3F2FD' },
  { value: 33554432,   symbol: 'MOG',   emoji: '😼', color: '#673AB7', bg: '#EDE7F6' },
  { value: 67108864,   symbol: 'POPCAT',emoji: '🐱', color: '#FF4081', bg: '#FCE4EC' },
  { value: 134217728,  symbol: 'TURBO', emoji: '🚀', color: '#FF6D00', bg: '#FFF3E0' },
  { value: 268435456,  symbol: 'NEIRO', emoji: '🐕', color: '#8BC34A', bg: '#F1F8E9' },
  { value: 536870912,  symbol: 'BOME',  emoji: '💣', color: '#FF5722', bg: '#FBE9E7' },
  { value: 1073741824, symbol: 'MG',    emoji: '🌿', color: '#00A86B', bg: '#E8F5E9' }, // 1B = MINTGROW
];

export const getCoinForValue = (value: number) => {
  const exact = COIN_TILES.find(c => c.value === value);
  if (exact) return exact;
  // For values beyond 1B, return last
  return COIN_TILES[COIN_TILES.length - 1];
};
