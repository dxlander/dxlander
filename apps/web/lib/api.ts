/**
 * tRPC Client for DXLander
 * Provides type-safe API calls to the backend
 */

// Simple REST API for setup status (used by middleware)
interface SetupStatusResponse {
  setupComplete: boolean
  hasAdminUser: boolean
  databaseConnected: boolean
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const simpleApi = {
  setup: {
    async getStatus(): Promise<SetupStatusResponse> {
      const response = await fetch(`${API_BASE_URL}/setup/status`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`Setup status check failed: ${response.status}`)
      }

      return response.json()
    },
  },
}

export type { SetupStatusResponse }