/**
 * Server-Sent Events (SSE) Service
 *
 * Provides real-time streaming of progress updates to clients.
 * This is the enterprise-grade approach for one-way server→client communication.
 *
 * Benefits over polling:
 * - Real-time updates (no delay)
 * - Efficient (server pushes only when there's new data)
 * - Scalable (no constant polling requests)
 * - Auto-reconnects on connection drop
 * - Works with standard HTTP/HTTPS
 */

/* eslint-disable no-undef */
import type { Context } from 'hono';
import { db, schema } from '@dxlander/database';
import { eq, desc } from 'drizzle-orm';

interface SSEClient {
  id: string;
  send: (data: any) => void;
  close: () => void;
}

/**
 * SSE Service for managing real-time connections
 */
export class SSEService {
  private static clients = new Map<string, Set<SSEClient>>();

  /**
   * Create SSE connection and stream analysis progress
   */
  static async streamAnalysisProgress(c: Context, analysisId: string): Promise<Response> {
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout | null = null;
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        const message = `data: ${JSON.stringify({ type: 'connected', analysisId })}\n\n`;
        controller.enqueue(encoder.encode(message));

        // Function to send progress updates
        const sendUpdate = async () => {
          if (closed) return;

          try {
            // Get latest analysis status and logs
            const analysis = await db.query.analysisRuns.findFirst({
              where: eq(schema.analysisRuns.id, analysisId),
            });

            if (!analysis) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', error: 'Analysis not found' })}\n\n`
                )
              );
              controller.close();
              return;
            }

            // Get activity logs
            const logs = await db.query.analysisActivityLogs.findMany({
              where: eq(schema.analysisActivityLogs.analysisRunId, analysisId),
              orderBy: [desc(schema.analysisActivityLogs.timestamp)],
              limit: 50,
            });

            const activityLog = logs
              .map((log) => ({
                id: log.id,
                action: log.action,
                status: log.status,
                result: log.result || undefined,
                details: log.details
                  ? typeof log.details === 'string'
                    ? JSON.parse(log.details)
                    : log.details
                  : undefined,
                timestamp: log.timestamp.toISOString(),
              }))
              .reverse(); // Oldest first

            const progressData = {
              type: 'progress',
              id: analysis.id,
              status: analysis.status,
              progress: analysis.progress || 0,
              currentAction: logs[0]?.action || 'Starting...',
              currentResult: logs[0]?.result || 'Initializing analysis',
              activityLog,
              results: analysis.results ? JSON.parse(analysis.results) : null,
              error: analysis.errorMessage,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));

            // Stop streaming if analysis is complete or failed
            if (analysis.status === 'complete' || analysis.status === 'failed') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'done', status: analysis.status })}\n\n`
                )
              );
              if (intervalId) clearInterval(intervalId);
              controller.close();
              closed = true;
            }
          } catch (error) {
            console.error('Error sending SSE update:', error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch progress' })}\n\n`
              )
            );
          }
        };

        // Send initial update immediately
        await sendUpdate();

        // Send updates every 500ms
        intervalId = setInterval(sendUpdate, 500);
      },

      cancel() {
        closed = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  /**
   * Create SSE connection and stream config generation progress
   */
  static async streamConfigProgress(c: Context, configSetId: string): Promise<Response> {
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout | null = null;
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        const message = `data: ${JSON.stringify({ type: 'connected', configSetId })}\n\n`;
        controller.enqueue(encoder.encode(message));

        // Function to send progress updates
        const sendUpdate = async () => {
          if (closed) return;

          try {
            // Get latest config status and logs
            const configSet = await db.query.configSets.findFirst({
              where: eq(schema.configSets.id, configSetId),
            });

            if (!configSet) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', error: 'Config set not found' })}\n\n`
                )
              );
              controller.close();
              return;
            }

            // Get activity logs
            const logs = await db.query.configActivityLogs.findMany({
              where: eq(schema.configActivityLogs.configSetId, configSetId),
              orderBy: [desc(schema.configActivityLogs.timestamp)],
              limit: 50,
            });

            const activityLog = logs
              .map((log) => ({
                id: log.id,
                action: log.action,
                status: log.status,
                result: log.result || undefined,
                details: log.details ? JSON.parse(log.details) : undefined,
                timestamp: log.timestamp.toISOString(),
              }))
              .reverse(); // Oldest first

            const progressData = {
              type: 'progress',
              id: configSet.id,
              status: configSet.status,
              progress: configSet.progress || 0,
              activityLog,
              error: configSet.errorMessage,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));

            // Stop streaming if generation is complete or failed
            if (configSet.status === 'complete' || configSet.status === 'failed') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'done', status: configSet.status })}\n\n`
                )
              );
              if (intervalId) clearInterval(intervalId);
              controller.close();
              closed = true;
            }
          } catch (error) {
            console.error('Error sending SSE update:', error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', error: 'Failed to fetch progress' })}\n\n`
              )
            );
          }
        };

        // Send initial update immediately
        await sendUpdate();

        // Send updates every 500ms
        intervalId = setInterval(sendUpdate, 500);
      },

      cancel() {
        closed = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  /**
   * Send heartbeat to keep connection alive
   */
  private static sendHeartbeat(client: SSEClient): void {
    try {
      client.send({ type: 'heartbeat', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }
}
