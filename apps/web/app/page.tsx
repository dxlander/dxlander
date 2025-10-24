"use client"

/**
 * Homepage Component
 * This page should never render directly because middleware handles routing:
 * - If setup incomplete: redirects to /setup
 * - If setup complete: redirects to /dashboard
 *
 * This component only shows if middleware fails or during loading
 */

export default function HomePage() {
  // This should rarely render due to middleware redirects
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ocean-50 to-white">
      <div className="text-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-ocean-600 mx-auto mb-4"></div>
          <div className="absolute inset-0 rounded-full h-12 w-12 border-r-3 border-ocean-300 animate-ping mx-auto"></div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">DXLander</h1>
        <p className="text-gray-600">Initializing your deployment automation platform...</p>
      </div>
    </div>
  )
}