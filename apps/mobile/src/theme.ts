// Design tokens, copied from the design's default "lafayette" palette (frontend/index.html, :root and PALETTES).
// The other palettes in the design are not used: the app has one look, light-only.
export const colors = {
  page: '#4A111E',
  bg: '#F8E5BF',
  surface: '#FFF1D2',
  surface2: '#E9C887',
  ink: '#351018',
  ink2: '#6C3F42',
  ink3: '#744D47',
  live: '#861F2C',
  idle: '#B76524',
  off: '#8B6B5B',
  logoGold: '#FAC165',
  accentInk: '#FFF3D7',

  // Text and lines on top of photos and on the dark maroon screens.
  onImage: '#FFF3D7',
  onImageMuted: 'rgba(255,243,215,0.80)',
  onImageFaint: 'rgba(255,243,215,0.62)',
  imageShadow: 'rgba(31,4,11,0.72)',
  imageOverlay: 'rgba(45,8,19,0.94)',
  imageOverlayMid: 'rgba(45,8,19,0.77)',
  imageOverlayEnd: 'rgba(45,8,19,0.40)',

  rim: 'rgba(134,31,44,0.18)',
  liveLine: 'rgba(134,31,44,0.50)',
  strip: 'rgba(250,193,101,0.45)',
  recentOutline: 'rgba(252,224,180,0.20)',

  // The design mixes these in oklch (color-mix); these are the resulting sRGB values.
  scheduleBg: '#6C3431',
  scheduleHover: '#7D473D',
  // --player-glass: surface at 58% over the blurred content (the design's value).
  playerGlass: 'rgba(255,241,210,0.58)',
  // The same look on iOS, where the native blur already adds about a third of white of its own: at 58% the dock came
  // out lighter than the design (215,183,161 against 195,161,142 over the maroon), so the tint is lowered to match.
  playerGlassOverBlur: 'rgba(255,241,210,0.40)',
  // Opaque stand-in for the glass where blur is not available.
  playerGlassFallback: 'rgba(255,241,210,0.94)',
} as const;

// Font family names as registered in src/app/_layout.tsx. Inter is the body face; "WJRH Display" is Barlow
// Condensed ExtraBold. On native each weight is its own family, so do not also set fontWeight.
export const fonts = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'WJRHDisplay',
} as const;

// Gradients from the design (CSS `linear-gradient(180deg, ...)` stops), as expo-linear-gradient props.
export const gradients = {
  now: { colors: ['rgba(31,4,11,0.22)', 'rgba(31,4,11,0.05)', 'rgba(31,4,11,0.94)'], locations: [0, 0.3, 1] },
  hero: { colors: ['rgba(53,16,24,0.04)', 'rgba(53,16,24,0.88)'], locations: [0.12, 1] },
  tile: { colors: ['rgba(53,16,24,0.03)', 'rgba(53,16,24,0.88)'], locations: [0.18, 1] },
  // Show page hero: clear until 54%, then the dark overlay. Same colour at alpha 0 (not "transparent") so
  // iOS does not grey the blend.
  showShade: { colors: ['rgba(45,8,19,0)', 'rgba(45,8,19,0.77)'], locations: [0.54, 1] },
  // A recent-track row: dark on the left where the text is, lighter to the right.
  recentRow: {
    colors: ['rgba(45,8,19,0.94)', 'rgba(45,8,19,0.77)', 'rgba(45,8,19,0.40)'],
    locations: [0, 0.56, 1],
  },
} as const;

/**
 * React Native draws the display face about 0.095 em higher inside its line box than a browser does (the two
 * read the font's ascent and descent differently), so display text is pushed down by this much to land where
 * the design has it. Measured against the design at 22 px (2 pt) and 42 px (4 pt).
 */
export const DISPLAY_NUDGE = 0.095;

/** Width of the phone's content below which the design uses its narrow layouts (25rem = 400px). */
export const WIDE_LAYOUT_MIN_WIDTH = 400;
