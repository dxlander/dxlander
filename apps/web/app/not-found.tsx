import React from 'react';

/**
 * A custom 404 "Not Found" page component.
 *
 * This component is designed to be framework-agnostic and compatible with
 * standard React environments, as Next.js-specific modules like
 * 'next/navigation' and 'next/link' may not be available during compilation.
 *
 * It uses standard web APIs (`window.history.back()`) and HTML elements (`<a>`)
 * to provide the same functionality.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 font-inter">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl md:p-12">
        <header>
          {/* Large 404 heading with an ocean-blue gradient */}
          <h1 className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-8xl font-extrabold text-transparent md:text-9xl">
            404
          </h1>
        </header>

        <main className="mt-6">
          <h2 className="text-2xl font-semibold text-gray-800 md:text-3xl">Page Not Found</h2>
          <p className="mt-3 text-base text-gray-600 md:text-lg">
            Oops! It seems like you've drifted into uncharted waters. The page you're looking for
            isn't here.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            {/* "Go Home" button using a standard <a> tag */}
            <a
              href="/"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go Home
            </a>

            {/* "Go Back" button using window.history.back() for navigation */}
            <button
              onClick={() => window.history.back()}
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
