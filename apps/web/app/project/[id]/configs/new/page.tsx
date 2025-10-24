'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageLayout, Header, Section } from '@/components/layouts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AIActivityMonitor } from '@/components/analysis'
import {
  ArrowLeft,
  FileCode,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Container,
  Terminal,
  GitBranch,
  Settings,
  Zap,
  XCircle
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

const configTypes = [
  {
    id: 'docker',
    name: 'Container (Docker)',
    description: 'Containerized deployment with Docker (automatically detects multi-service needs)',
    icon: Container,
    files: ['Dockerfile', 'docker-compose.yml (if needed)', '.dockerignore'],
    recommended: true
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Production-grade container orchestration',
    icon: GitBranch,
    files: ['deployment.yaml', 'service.yaml', 'ingress.yaml', 'configmap.yaml'],
    recommended: false
  },
  {
    id: 'bash',
    name: 'Bash Script',
    description: 'Deployment automation with shell scripts',
    icon: Terminal,
    files: ['deploy.sh', 'setup.sh'],
    recommended: false
  }
]

export default function NewConfigurationPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>('docker')
  const [isGenerating, setIsGenerating] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [stage, setStage] = useState<'select' | 'analyzing' | 'generating'>('select')

  const { data: project, isLoading, error } = trpc.projects.get.useQuery({
    id: resolvedParams.id
  })

  // Get AI provider status
  const { data: aiProviderStatus, isLoading: isLoadingProviderStatus } = trpc.aiProviders.getDefaultStatus.useQuery()

  // Mutation for starting analysis
  const analyzeMutation = trpc.analysis.analyze.useMutation()

  // Mutation for generating config
  const generateConfigMutation = trpc.configs.generate.useMutation()

  // Poll analysis progress (faster for better UX)
  const { data: analysisProgress, isLoading: isLoadingProgress } = trpc.analysis.getProgress.useQuery(
    { analysisId: analysisId! },
    {
      enabled: !!analysisId && stage === 'analyzing',
      refetchInterval: 500, // Poll every 500ms for real-time feel
      refetchIntervalInBackground: true // Keep polling even when tab is not focused
    }
  )

  // Watch for analysis completion and start config generation
  useEffect(() => {
    if (analysisProgress?.status === 'complete' && stage === 'analyzing') {
      setStage('generating')

      // Start config generation
      generateConfigMutation.mutate({
        projectId: resolvedParams.id,
        analysisId: analysisId!,
        configType: selectedType as 'docker' | 'kubernetes' | 'bash'
      }, {
        onSuccess: (result) => {
          // Redirect to the generated config view
          router.push(`/project/${resolvedParams.id}/configs/${result.configSetId}`)
        },
        onError: (error) => {
          console.error('Config generation failed:', error)
          setStage('select')
          setIsGenerating(false)
        }
      })
    }
  }, [analysisProgress?.status, stage])

  if (isLoading) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </Section>
      </PageLayout>
    )
  }

  if (error || !project) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <Card className="border-red-200">
            <CardContent className="p-16 text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h3>
              <p className="text-gray-600 mb-8">
                The project you're looking for doesn't exist or you don't have access to it.
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
    )
  }

  const handleGenerate = async () => {
    // Check if AI provider is configured
    if (!aiProviderStatus?.hasProvider) {
      return // Button should be disabled, but just in case
    }

    setIsGenerating(true)
    setStage('analyzing')

    try {
      // Start AI analysis
      const result = await analyzeMutation.mutateAsync({
        projectId: resolvedParams.id,
        forceReanalysis: false // Use cached if available
      })

      setAnalysisId(result.analysisId)
      // Analysis progress will be polled automatically
      // When complete, useEffect will trigger config generation
    } catch (error: any) {
      console.error('Failed to start analysis:', error)

      // Show error message if it's about missing AI provider
      if (error.message?.includes('No default AI provider')) {
        // Error banner is already shown above
      }

      setIsGenerating(false)
      setStage('select')
    }
  }

  const headerActions = (
    <div className="flex items-center gap-3">
      <Link href={`/project/${resolvedParams.id}/configs`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Configurations
        </Button>
      </Link>
    </div>
  )

  return (
    <PageLayout background="default">
      <Header
        title="Generate Build Configuration"
        subtitle="Choose a configuration type for your project"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-5xl mx-auto px-6 space-y-8">
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
                          <p className="text-sm font-medium text-gray-900">
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
                        <p className="text-xs text-gray-600">
                          This provider will be used for project analysis
                        </p>
                      </div>
                      <Link href="/dashboard/settings?tab=ai-providers">
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
                        <h3 className="font-semibold text-gray-900 mb-2">
                          No AI Provider Configured
                        </h3>
                        <p className="text-sm text-gray-700 mb-4">
                          To generate configuration files, you need to configure an AI provider first.
                          This will enable automatic project analysis and intelligent configuration generation.
                        </p>
                        <Link href="/dashboard/settings?tab=ai-providers">
                          <Button size="sm" className="bg-gradient-to-r from-ocean-600 to-ocean-500">
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
                  progress={analysisProgress.progress || 0}
                  currentActivity={analysisProgress.currentAction || 'Starting discovery...'}
                  activityLog={analysisProgress.activityLog || []}
                  status={analysisProgress.status === 'complete' ? 'complete' : analysisProgress.status === 'failed' ? 'error' : 'analyzing'}
                />
              ) : (
                <Card variant="elevated">
                  <CardContent className="p-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-ocean-600 mx-auto mb-4" />
                    <p className="text-gray-600">Initializing AI analysis...</p>
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
                    <p className="font-medium text-gray-900">Creating {selectedType} configuration files...</p>
                    <p className="text-sm text-gray-600 mt-1">
                      AI is generating optimized deployment configurations based on discovery results
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Type Selection - Only show in select stage */}
          {stage === 'select' && (
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Configuration Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {configTypes.map((type) => {
                    const Icon = type.icon
                    const isSelected = selectedType === type.id

                    return (
                      <Card
                        key={type.id}
                        className={cn(
                          'cursor-pointer transition-all',
                          isSelected
                            ? 'border-ocean-500 border-2 bg-ocean-50/30'
                            : 'hover:border-ocean-300 hover:bg-ocean-50/10'
                        )}
                        onClick={() => setSelectedType(type.id)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div
                              className={cn(
                                'p-3 rounded-xl flex-shrink-0',
                                isSelected ? 'bg-ocean-100' : 'bg-gray-100'
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-6 w-6',
                                  isSelected ? 'text-ocean-600' : 'text-gray-600'
                                )}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900">{type.name}</h4>
                                {type.recommended && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                    Recommended
                                  </span>
                                )}
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-ocean-600 ml-auto" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{type.description}</p>

                              <div className="flex flex-wrap gap-1.5">
                                {type.files.map((file, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono"
                                  >
                                    {file}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>

              {/* Preview & Generate */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-lg bg-ocean-50/30 border border-ocean-200">
                    <FileCode className="h-5 w-5 text-ocean-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {configTypes.find((t) => t.id === selectedType)?.name} Configuration
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        {configTypes.find((t) => t.id === selectedType)?.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {configTypes
                          .find((t) => t.id === selectedType)
                          ?.files.map((file, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-white border border-ocean-200 text-gray-700 px-2.5 py-1 rounded font-mono"
                            >
                              {file}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Configuration will be generated based on discovery v2
                    </p>
                    <div className="flex items-center gap-3">
                      <Link href={`/project/${resolvedParams.id}/configs`}>
                        <Button variant="outline">Cancel</Button>
                      </Link>
                      <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || !aiProviderStatus?.hasProvider || isLoadingProviderStatus}
                        className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                        title={!aiProviderStatus?.hasProvider ? 'Configure an AI provider first' : undefined}
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
            </>
          )}
        </div>
      </Section>
    </PageLayout>
  )
}
