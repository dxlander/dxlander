'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NotFound() {
  const prefersReducedMotion = useReducedMotion();

  const [stars, setStars] = useState<
    Array<{ top: string; left: string; scale: number; duration: number }>
  >([]);

  useEffect(() => {
    // Generate random stars only after hydration (client side)
    setStars(
      [...Array(20)].map(() => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        scale: Math.random() * 1.5,
        duration: 3 + Math.random() * 2,
      }))
    );
  }, []);

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-gray-900 via-gray-950 to-black text-center text-white">
      {/* Floating stars background */}
      <div className="absolute inset-0 z-0">
        {!prefersReducedMotion &&
          stars.map((star, i) => (
            <motion.span
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-70"
              initial={{
                top: star.top,
                left: star.left,
                scale: star.scale,
              }}
              animate={{
                opacity: [0.4, 1, 0.4],
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

      {/* Astronaut emoji with subtle float */}
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: [0, -20, 0] }}
        transition={{
          repeat: Infinity,
          duration: 4,
          ease: 'easeInOut',
        }}
        className="z-10 text-7xl mb-6"
      >
        🧑‍🚀
      </motion.div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="z-10"
      >
        <h1 className="text-4xl font-bold mb-2">404: Lost in Space</h1>
        <p className="text-gray-300 max-w-md mx-auto mb-8">
          Looks like you’ve drifted off course. Let’s guide you back to safety.
        </p>
      </motion.div>

      {/* Buttons */}
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
