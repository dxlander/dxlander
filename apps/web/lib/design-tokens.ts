// Design Tokens for DXLander
// Use these constants for consistent spacing, colors, and animations

export const spacing = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
  '4xl': '6rem',  // 96px
  '5xl': '8rem',  // 128px
} as const

export const borderRadius = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '0.75rem',    // 12px (same as lg for consistency)
  '2xl': '1rem',    // 16px
  full: '9999px',   // fully rounded
} as const

export const shadows = {
  elegant: '0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(37, 99, 235, 0.06)',
  'elegant-lg': '0 10px 15px -3px rgba(59, 130, 246, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05)',
  ocean: '0 8px 25px -5px rgba(59, 130, 246, 0.3), 0 8px 10px -6px rgba(37, 99, 235, 0.2)',
} as const

export const animations = {
  // Standard hover effects
  hover: {
    scale: 'hover:scale-[1.02]',
    scaleSmall: 'hover:scale-[1.01]',
  },
  // Standard active effects
  active: {
    scale: 'active:scale-[0.98]',
    scaleSmall: 'active:scale-[0.99]',
  },
  // Transitions
  transition: {
    default: 'transition-all duration-300 ease-out',
    fast: 'transition-all duration-200 ease-out',
    slow: 'transition-all duration-500 ease-out',
  },
} as const

export const colors = {
  ocean: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Primary brand color
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
} as const

export const typography = {
  fontFamily: {
    primary: ['Satoshi', 'system-ui', 'sans-serif'],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    bold: '700',
    black: '900',
  },
} as const

// Component patterns for consistency
export const patterns = {
  // Standard component spacing
  componentPadding: {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },

  // Standard grid gaps
  gridGap: {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  },

  // Standard container classes
  container: 'container mx-auto px-6',

  // Interactive states
  interactive: {
    cursor: 'cursor-pointer disabled:cursor-not-allowed',
    hover: 'hover:scale-[1.02] active:scale-[0.98]',
    hoverSubtle: 'hover:scale-[1.01] active:scale-[0.99]',
    focus: 'focus-visible:ring-2 focus-visible:ring-ocean-500/20 focus-visible:ring-offset-2',
  },

  // Background patterns
  pageBackground: [
    'absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.02),transparent_70%)]',
    'absolute top-1/4 left-1/4 w-96 h-96 bg-ocean-500/3 rounded-full blur-3xl',
    'absolute bottom-1/4 right-1/4 w-80 h-80 bg-ocean-600/2 rounded-full blur-3xl',
  ],

  // Glass effects
  glass: {
    default: 'backdrop-blur-xl bg-white/10 border-white/20',
    ocean: 'backdrop-blur-xl bg-ocean-50/20 border-ocean-200/30',
    subtle: 'backdrop-blur-sm bg-white/80',
  },
} as const

// Component-specific design tokens
export const components = {
  button: {
    base: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 ease-out cursor-pointer disabled:cursor-not-allowed',
    focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants: {
      default: 'bg-gradient-to-r from-ocean-700 via-ocean-600 to-ocean-500 text-white shadow-lg hover:shadow-xl hover:shadow-ocean-500/30',
      secondary: 'bg-gradient-to-r from-ocean-50 to-ocean-100 text-ocean-800 shadow-md hover:shadow-lg border border-ocean-200/50',
      outline: 'border-2 border-ocean-200 bg-white/50 backdrop-blur-sm text-ocean-700 shadow-md hover:shadow-lg',
      ghost: 'text-ocean-700 hover:bg-gradient-to-r hover:from-ocean-50 hover:to-ocean-100 hover:text-ocean-800',
    },
  },

  badge: {
    base: 'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 ease-out',
    variants: {
      default: 'border-transparent bg-gradient-to-r from-ocean-600 to-ocean-700 text-white shadow-md',
      secondary: 'border-ocean-200/60 bg-ocean-50/80 text-ocean-700 hover:bg-ocean-100/80 backdrop-blur-sm',
      outline: 'border-ocean-300 text-ocean-700 hover:bg-ocean-50/50',
    },
  },

  tabs: {
    list: 'inline-flex h-11 items-center justify-center rounded-xl bg-ocean-50/50 border border-ocean-200/60 p-1 text-ocean-600 shadow-md backdrop-blur-sm',
    trigger: 'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 ease-out cursor-pointer',
    triggerActive: 'bg-gradient-to-r from-ocean-600 to-ocean-700 text-white shadow-lg shadow-ocean-500/30 scale-[1.02]',
    triggerInactive: 'text-ocean-600 hover:text-ocean-700 hover:bg-white/60',
  },

  card: {
    base: 'rounded-2xl border-2 bg-card text-gray-900 shadow-xl transition-all duration-300 ease-out',
    variants: {
      default: 'border-ocean-200/50 bg-white shadow-lg shadow-ocean-500/5 hover:shadow-xl hover:shadow-ocean-500/10',
      interactive: 'border-ocean-200/60 bg-white shadow-ocean-500/10 hover:shadow-2xl hover:shadow-ocean-500/25 hover:scale-[1.02] cursor-pointer',
      elevated: 'border-ocean-300/50 bg-ocean-50/30 shadow-2xl shadow-ocean-500/15 hover:shadow-3xl hover:shadow-ocean-500/25',
    },
  },
} as const