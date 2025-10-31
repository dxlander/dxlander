'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFoundPage() {
  const router = useRouter();

  // ...Your getOceanFact function (keep if you need; skip to launch fast)

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-50 font-sans">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 text-center shadow-xl md:p-12">
        <header>
          <h1 className="bg-linear-to-r from-blue-500 to-cyan-400 bg-clip-text text-8xl font-extrabold text-transparent md:text-9xl">
            404
          </h1>
        </header>
        <main className="mt-6">
          <h2 className="text-2xl font-semibold text-gray-800 md:text-3xl">Page Not Found</h2>
          <p className="mt-3 text-base text-gray-600 md:text-lg">
            Oops! It seems like you've drifted into uncharted waters. The page you're looking for
            isn't here.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go Home
            </Link>
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Go Back
            </button>
          </div>
          {/* Optional: Gemini API ocean fact section can go here */}
        </main>
      </div>
    </div>
  );
}
