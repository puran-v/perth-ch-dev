// Colors
export const COLORS = {
  primary: {
    DEFAULT: '#042E93',
    light: '#E0EDFF',
    dark: '#031F66',
    hover: '#0336A8',
  },
  success: {
    DEFAULT: '#16A34A',
    light: '#DCFCE7',
    bg: 'rgba(22, 163, 74, 0.2)',
  },
  warning: {
    DEFAULT: '#FF9F29',
    light: '#FEF3C7',
  },
  danger: {
    DEFAULT: '#FF4747',
    light: '#FEE2E2',
  },
  info: {
    DEFAULT: '#0062FF',
    light: '#E0EDFF',
  },
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
} as const;

// Spacing
export const SPACING = {
  page: {
    paddingX: 'px-8',
    paddingY: 'py-6',
  },
  card: {
    padding: 'p-6',
    gap: 'gap-6',
  },
  section: {
    gap: 'gap-8',
  },
} as const;

// Typography
export const TYPOGRAPHY = {
  pageTitle: 'text-2xl font-semibold text-neutral-900',
  sectionTitle: 'text-lg font-semibold text-neutral-900',
  cardTitle: 'text-sm font-medium text-neutral-600',
  cardValue: 'text-2xl font-bold text-neutral-900',
  body: 'text-sm text-neutral-600',
  label: 'text-sm font-medium text-neutral-700',
  caption: 'text-xs text-neutral-500',
} as const;

// Border Radius
export const RADII = {
  sm: 'rounded-md',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
} as const;
