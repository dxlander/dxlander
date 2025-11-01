'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Homepage Component
 * This page should never render directly because middleware handles routing:
 * - If setup incomplete: redirects to /setup
 * - If setup complete: redirects to /dashboard
 *
 * Displays a skeleton loader (instead of spinner) while middleware or data loads.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-ocean-50/40 to-white p-6 gap-6">
      {/* Sidebar Skeleton */}
      <aside className="w-64 hidden md:flex flex-col space-y-6">
        <div>
          <Skeleton className="h-10 w-3/4 mb-4" /> {/* Logo */}
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 space-y-10">
        {/* Header area */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>

        {/* Main chart/section */}
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </main>
    </div>
  );
}
