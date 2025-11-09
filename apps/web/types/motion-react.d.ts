declare module 'motion/react' {
  export const motion: typeof import('framer-motion').motion;
  export const useReducedMotion: typeof import('framer-motion').useReducedMotion;
  export * from 'framer-motion';
}
