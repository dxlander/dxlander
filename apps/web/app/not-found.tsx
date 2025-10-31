'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import Link from 'next/link';

export default function NotFound() {
  const prefersReducedMotion = useReducedMotion();

  const stars = useMemo(
    () =>
      [...Array(20)].map(() => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        scale: Math.random() * 1.5,
        duration: 3 + Math.random() * 2,
      })),
    []
  );

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-gray-900 via-gray-950 to-black text-center text-white">
      {!prefersReducedMotion && (
        <div className="absolute inset-0 z-0">
          {stars.map((star, i) => (
            <motion.span
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-70"
              initial={{
                top: star.top,
                left: star.left,
                scale: star.scale,
              }}
              animate={{
                opacity: [0.5, 1, 0.5],
                y: ['0%', '10%', '0%'],
              }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-6xl font-bold mb-4"
      >
        404
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="z-10 mb-8 text-lg text-gray-400"
      >
        Lost in space. The page you’re looking for doesn’t exist.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        className="z-10 flex gap-4"
      >
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 rounded-full bg-gray-700 font-semibold text-white hover:bg-gray-600 transition-colors shadow-lg"
        >
          Go Back
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-blue-600 font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
        >
          Return to Base
        </Link>
      </motion.div>
    </main>
  );
}
