import { z } from 'zod';
import { router, protectedProcedure, IdSchema } from '@dxlander/shared';
import { AIAnalysisService } from '../services/ai-analysis.service';

export const analysisRouter = router({
  /**
   * Start AI analysis for a project
   */
  analyze: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        forceReanalysis: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId } = ctx;
        if (!userId) {
          throw new Error('User not authenticated');
        }

        // Start analysis (runs in background)
        const analysisId = await AIAnalysisService.analyzeProject(input.projectId, userId);

        return {
          analysisId,
          status: 'analyzing',
          message: 'AI analysis started. Use getProgress to track progress.',
        };
      } catch (error) {
        console.error('Failed to start analysis:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to start AI analysis');
      }
    }),

  /**
   * Get analysis progress and current status
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        analysisId: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const progress = await AIAnalysisService.getAnalysisProgress(input.analysisId);

        if (!progress) {
          throw new Error('Analysis not found');
        }

        return progress;
      } catch (error) {
        console.error('Failed to get analysis progress:', error);
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('Failed to retrieve analysis progress');
      }
    }),

  /**
   * Get final analysis results
   */
  getResult: protectedProcedure.input(IdSchema).query(async ({ input }) => {
    try {
      const results = await AIAnalysisService.getAnalysisResults(input.id);

      if (!results) {
        return null;
      }

      return results;
    } catch (error) {
      console.error('Failed to get analysis results:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to retrieve analysis results');
    }
  }),
});
