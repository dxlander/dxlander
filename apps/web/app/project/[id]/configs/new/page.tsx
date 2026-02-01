'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageLayout, Header, Section } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AIActivityMonitor } from '@/components/analysis';
import {
  ArrowLeft,
  FileCode,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Container,
  Settings,
  Zap,
  XCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAnalysisProgress } from '@/lib/hooks/useSSE';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function NewConfigurationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [stage, setStage] = useState<'ready' | 'analyzing' | 'generating'>('ready');

  const {
    data: project,
    isLoading,
    error,
  } = trpc.projects.get.useQuery({
    id: resolvedParams.id,
  });

  const { data: aiProviderStatus, isLoading: isLoadingProviderStatus } =
    trpc.aiProviders.getDefaultStatus.useQuery();

  const analyzeMutation = trpc.analysis.analyze.useMutation();
  const generateConfigMutation = trpc.configs.generate.useMutation();

  const { data: analysisProgressSSE } = useAnalysisProgress(analysisId, stage === 'analyzing');
  const analysisProgress = analysisProgressSSE;

  useEffect(() => {
    if (!analysisProgress || stage !== 'analyzing') return;

    if (analysisProgress.status === 'failed') {
      console.error('Analysis failed:', analysisProgress.error);
      setIsGenerating(false);
      setStage('ready');

      if (analysisId) {
        router.push(`/project/${resolvedParams.id}/logs?run=${analysisId}`);
      }
      return;
    }

    if (analysisProgress.status === 'complete' && analysisId) {
      setStage('generating');

      generateConfigMutation.mutate(
        {
          projectId: resolvedParams.id,
          analysisId,
        },
        {
          onSuccess: (result) => {
            router.push(`/project/${resolvedParams.id}/configs/${result.configSetId}`);
          },
          onError: (error) => {
            console.error('Config generation failed:', error);
            setStage('ready');
            setIsGenerating(false);
          },
        }
      );
    }
  }, [
    analysisProgress?.status,
    analysisProgress?.error,
    stage,
    analysisId,
    generateConfigMutation,
    resolvedParams.id,
    router,
  ]);

  if (isLoading) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </Section>
      </PageLayout>
    );
  }

  if (error || !project) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <Card className="border-red-200">
            <CardContent className="p-16 text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Project Not Found</h3>
              <p className="text-muted-foreground mb-8">
                The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access
                to it.
              </p>
              <Link href="/dashboard">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Section>
      </PageLayout>
    );
  }

  const handleGenerate = async () => {
    if (!aiProviderStatus?.hasProvider) {
      return;
    }

    setIsGenerating(true);
    setStage('analyzing');

    try {
      const result = await analyzeMutation.mutateAsync({
        projectId: resolvedParams.id,
        forceReanalysis: false,
      });

      setAnalysisId(result.analysisId);
    } catch (error: unknown) {
      console.error('Failed to start analysis:', error);
      setIsGenerating(false);
      setStage('ready');
    }
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      <Link href={`/project/${resolvedParams.id}/configs`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Configurations
        </Button>
      </Link>
    </div>
  );

  return (
    <PageLayout background="default">
      <Header
        title="Generate Build Configuration"
        subtitle="Create Docker + docker-compose.yml for deployment"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          {/* AI Provider Status Banner */}
          {!isLoadingProviderStatus && (
            <>
              {aiProviderStatus?.hasProvider ? (
                <Card className="border-ocean-200 bg-gradient-to-r from-ocean-50/30 to-blue-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-ocean-100 rounded-lg">
                        <Zap className="h-5 w-5 text-ocean-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-foreground">
                            AI Provider: {aiProviderStatus.provider?.name}
                          </p>
                          <Badge variant="secondary" className="bg-ocean-100 text-ocean-700">
                            {aiProviderStatus.provider?.model}
                          </Badge>
                          {aiProviderStatus.provider?.lastTestStatus === 'success' && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This provider will be used for project analysis
                        </p>
                      </div>
                      <Link href="/dashboard/settings/ai-providers">
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Change
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-red-200 bg-red-50/30">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-100 rounded-lg flex-shrink-0">
                        <XCircle className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2">
                          No AI Provider Configured
                        </h3>
                        <p className="text-sm text-foreground mb-4">
                          To generate configuration files, you need to configure an AI provider
                          first. This will enable automatic project analysis and intelligent
                          configuration generation.
                        </p>
                        <Link href="/dashboard/settings/ai-providers">
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Configure AI Provider
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Show AI Activity Monitor during analysis */}
          {stage === 'analyzing' && (
            <>
              {analysisProgress ? (
                <AIActivityMonitor
                  currentActivity={analysisProgress.currentAction || 'Starting analysis...'}
                  activityLog={analysisProgress.activityLog || []}
                  status={
                    analysisProgress.status === 'complete'
                      ? 'complete'
                      : analysisProgress.status === 'failed'
                        ? 'error'
                        : 'analyzing'
                  }
                  error={analysisProgress.error}
                  projectId={resolvedParams.id}
                  analysisId={analysisId || undefined}
                />
              ) : (
                <Card variant="elevated">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-ocean-600 mx-auto mb-4" />
                    <p className="text-muted-foreground">Initializing analysis...</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Show generation progress */}
          {stage === 'generating' && (
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="text-xl">Generating Configuration Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-4">
                  <Loader2 className="h-6 w-6 text-ocean-600 animate-spin" />
                  <div>
                    <p className="font-medium text-foreground">
                      Creating Docker + docker-compose.yml...
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI is generating optimized deployment configurations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ready state - show what will be generated */}
          {stage === 'ready' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-ocean-100 rounded-lg">
                    <Container className="h-5 w-5 text-ocean-600" />
                  </div>
                  Docker Compose Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-muted-foreground">
                  Generate production-ready Docker configuration files for your project. The AI will
                  analyze your project and create optimized configurations.
                </p>

                <div className="p-4 rounded-lg bg-ocean-50/30 border border-ocean-200">
                  <h4 className="font-medium text-foreground mb-3">
                    Files that will be generated:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm bg-white border border-ocean-200 text-foreground px-3 py-1.5 rounded font-mono">
                      Dockerfile
                    </span>
                    <span className="text-sm bg-white border border-ocean-200 text-foreground px-3 py-1.5 rounded font-mono">
                      docker-compose.yml
                    </span>
                    <span className="text-sm bg-white border border-ocean-200 text-foreground px-3 py-1.5 rounded font-mono">
                      .dockerignore
                    </span>
                    <span className="text-sm bg-white border border-ocean-200 text-foreground px-3 py-1.5 rounded font-mono">
                      .env.example
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium text-foreground mb-2">What the AI will do:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Analyze your project structure and dependencies
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Detect framework, runtime, and build requirements
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Create multi-stage Dockerfile for optimal image size
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Generate docker-compose.yml with proper configuration
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Include health checks, environment variables, and ports
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Ready to generate configuration</p>
                  <div className="flex items-center gap-3">
                    <Link href={`/project/${resolvedParams.id}/configs`}>
                      <Button variant="outline">Cancel</Button>
                    </Link>
                    <Button
                      onClick={handleGenerate}
                      disabled={
                        isGenerating || !aiProviderStatus?.hasProvider || isLoadingProviderStatus
                      }
                      className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                      title={
                        !aiProviderStatus?.hasProvider
                          ? 'Configure an AI provider first'
                          : undefined
                      }
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileCode className="h-4 w-4 mr-2" />
                          Generate Configuration
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Section>
    </PageLayout>
  );
}
