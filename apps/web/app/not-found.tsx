'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-gray-900 via-gray-950 to-black text-center text-white">
      {/* Floating stars background */}
      <div className="absolute inset-0 z-0">
        {[...Array(30)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-70"
            initial={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              scale: Math.random() * 1.5,
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              y: ['0%', '10%', '0%'],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Animated floating astronaut/lander */}
      <motion.div
        initial={{ y: 0, rotate: 0 }}
        animate={{ y: [0, -15, 0], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="z-10 mb-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width="120"
          height="120"
          className="drop-shadow-lg"
        >
          <circle cx="128" cy="128" r="120" fill="#1e293b" />
          <path
            fill="#60a5fa"
            d="M128 60a20 20 0 0 0-20 20v36a20 20 0 0 0 40 0V80a20 20 0 0 0-20-20z"
          />
          <path fill="#3b82f6" d="M88 140h80a20 20 0 0 1 20 20v12H68v-12a20 20 0 0 1 20-20z" />
        </svg>
      </motion.div>

      {/* Message */}
      <motion.h1
        className="z-10 text-6xl font-extrabold mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        404 — Lost in Space
      </motion.h1>

      <motion.p
        className="z-10 text-gray-400 max-w-md mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        Looks like you drifted off course, commander. The page you’re looking for isn’t in this
        galaxy.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.7 }}
        className="z-10"
      >
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
