/**
 * useSSE Hook - Real-time Server-Sent Events
 *
 * Enterprise-grade hook for subscribing to real-time server updates.
 * Handles reconnection, error handling, and cleanup automatically.
 */

/* eslint-disable no-undef */
import { useEffect, useState, useRef, useCallback } from 'react';
import { config } from '@/lib/config';

interface SSEOptions {
  enabled?: boolean;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnectInterval?: number;
}

interface SSEState<T> {
  data: T | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Hook to subscribe to Server-Sent Events
 */
export function useSSE<T = any>(url: string, options: SSEOptions = {}): SSEState<T> {
  const { enabled = true, onMessage, onError, onOpen, reconnectInterval = 3000 } = options;

  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      // Get auth token
      const token = localStorage.getItem('dxlander-token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // Create EventSource with auth header (via query param since EventSource doesn't support headers)
      const fullUrl = `${config.apiUrl}${url}?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(fullUrl);

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened:', url);
        setIsConnected(true);
        setError(null);
        shouldReconnectRef.current = true;
        onOpen?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);

          // Handle different message types
          switch (parsedData.type) {
            case 'connected':
              console.log('[SSE] Connected to stream:', parsedData);
              break;

            case 'progress':
              setData(parsedData);
              onMessage?.(parsedData);
              break;

            case 'done':
              console.log('[SSE] Stream completed:', parsedData.status);
              shouldReconnectRef.current = false; // Don't reconnect after completion
              cleanup();
              break;

            case 'error':
              console.error('[SSE] Server error:', parsedData.error);
              setError(parsedData.error);
              break;

            case 'heartbeat':
              // Heartbeat to keep connection alive
              break;

            default:
              console.log('[SSE] Unknown message type:', parsedData.type);
          }
        } catch (err) {
          console.error('[SSE] Failed to parse message:', err, event.data);
        }
      };

      eventSource.onerror = (event) => {
        console.error('[SSE] Connection error:', event);
        setError('Connection error');
        setIsConnected(false);
        onError?.(event);

        // Attempt to reconnect if we should
        if (shouldReconnectRef.current) {
          cleanup();
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[SSE] Attempting to reconnect...');
            connect();
          }, reconnectInterval);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('[SSE] Failed to create connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [url, enabled, onMessage, onError, onOpen, cleanup, reconnectInterval]);

  // Connect when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return cleanup;
  }, [enabled, connect, cleanup]);

  return { data, isConnected, error };
}

/**
 * Hook specifically for analysis progress
 */
export function useAnalysisProgress(analysisId: string | null, enabled = true) {
  return useSSE(`/sse/analysis/${analysisId}`, {
    enabled: enabled && !!analysisId,
  });
}

/**
 * Hook specifically for config generation progress
 */
export function useConfigProgress(configSetId: string | null, enabled = true) {
  return useSSE(`/sse/config/${configSetId}`, {
    enabled: enabled && !!configSetId,
  });
}

/**
 * Deployment progress event data
 */
export interface DeploymentProgressData {
  type: 'connected' | 'progress' | 'done' | 'error';
  id: string;
  name?: string;
  status?: string;
  progress?: number;
  containerId?: string;
  imageId?: string;
  imageTag?: string;
  ports?: Array<{ host: number; container: number; protocol?: string }>;
  deployUrl?: string;
  currentAction?: string;
  currentResult?: string;
  activityLog?: Array<{
    id: string;
    action: string;
    result?: string;
    details?: any;
    timestamp?: string;
  }>;
  buildLogs?: string;
  runtimeLogs?: string;
  error?: string;
}

/**
 * Hook specifically for deployment progress
 *
 * Streams real-time deployment progress including:
 * - Status updates (pending, pre_flight, building, deploying, running, etc.)
 * - Activity logs
 * - Build and runtime logs
 * - Container and port information
 */
export function useDeploymentProgress(deploymentId: string | null, enabled = true) {
  return useSSE<DeploymentProgressData>(`/sse/deployment/${deploymentId}`, {
    enabled: enabled && !!deploymentId,
  });
}

/**
 * Session progress event data
 */
export interface SessionProgressData {
  type: 'connected' | 'progress' | 'done' | 'error';
  id: string;
  deploymentId: string;
  status: string;
  attemptNumber: number;
  maxAttempts: number;
  customInstructions?: string;
  agentState?: string;
  fileChanges?: Array<{
    file: string;
    before: string | null;
    after: string;
    reason: string;
    timestamp: string;
  }>;
  summary?: string;
  activityLog?: Array<{
    id: string;
    type: string;
    action: string;
    input?: string;
    output?: string;
    timestamp?: string;
  }>;
  buildLogs?: string;
  error?: string;
}

/**
 * Hook specifically for deployment session progress
 *
 * Streams real-time AI session progress including:
 * - Session status (active, completed, failed, cancelled)
 * - AI tool calls and results
 * - File modifications
 * - Build logs
 */
export function useDeploymentSessionProgress(sessionId: string | null, enabled = true) {
  return useSSE<SessionProgressData>(`/sse/session/${sessionId}`, {
    enabled: enabled && !!sessionId,
  });
}
