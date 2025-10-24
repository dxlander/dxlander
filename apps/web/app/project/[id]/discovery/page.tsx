'use client'

import { use } from 'react'
import Link from 'next/link'
import { PageLayout, Header, Section } from '@/components/layouts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AnalysisResults } from '@/components/analysis'
import {
  ArrowLeft,
  Download,
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { mockAnalysisResults } from '@/lib/mock-data'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function StackDiscoveryPage({ params }: PageProps) {
  const resolvedParams = use(params)

  const { data: project, isLoading, error } = trpc.projects.get.useQuery({
    id: resolvedParams.id
  })

  if (isLoading) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading stack detection results...</p>
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

  // For demo purposes, use mock data. In production, use project.discoveryResults
  const discoveryResults = (project as any).discoveryResults || mockAnalysisResults

  const headerActions = (
    <div className="flex items-center gap-3">
      <Link href={`/project/${resolvedParams.id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </Link>
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Export Report
      </Button>
      <Link href={`/project/${resolvedParams.id}/configs/new`}>
        <Button size="sm" className="bg-gradient-to-r from-ocean-600 to-ocean-500">
          <Plus className="h-4 w-4 mr-2" />
          Generate Config
        </Button>
      </Link>
    </div>
  )

  return (
    <PageLayout background="default">
      <Header
        title={`${project.name} - Stack Discovery`}
        subtitle="Detected project stack, dependencies, and required integrations"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6">
          <AnalysisResults results={discoveryResults} />
        </div>
      </Section>
    </PageLayout>
  )
}
