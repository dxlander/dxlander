'use client';

import { use } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FolderOpen,
  AlertCircle,
  Loader2,
  Eye,
  Settings,
  FileCode,
  Rocket,
  ExternalLink,
  ChevronRight,
  Plus,
  Download,
  RefreshCw,
  GitBranch,
  Archive,
  Calendar,
  HardDrive,
  Files,
  FolderTree,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime, formatDate } from '@dxlander/shared/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);

  // ALL HOOKS MUST BE CALLED AT THE TOP - BEFORE ANY CONDITIONAL RETURNS
  const {
    data: project,
    isLoading,
    error,
  } = trpc.projects.get.useQuery({
    id: resolvedParams.id,
  });

  // Fetch real configuration data - must be called unconditionally
  const { data: configSets = [] } = trpc.configs.list.useQuery({
    projectId: resolvedParams.id,
  });

  // NOW we can do conditional returns
  if (isLoading) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading project...</p>
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h3>
              <p className="text-gray-600 mb-8">
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

  const getStatusConfig = (status: string) => {
    const configs = {
      imported: {
        icon: <FolderOpen className="h-5 w-5" />,
        label: 'Imported',
        color: 'text-ocean-700 bg-ocean-50 border-ocean-200',
        description: 'Project files imported - ready to generate build configurations',
      },
      configured: {
        icon: <FileCode className="h-5 w-5" />,
        label: 'Configured',
        color: 'text-purple-700 bg-purple-50 border-purple-200',
        description: 'Build configurations ready for deployment',
      },
      deployed: {
        icon: <Rocket className="h-5 w-5" />,
        label: 'Deployed',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        description: 'Live deployment active',
      },
      failed: {
        icon: <AlertCircle className="h-5 w-5" />,
        label: 'Failed',
        color: 'text-red-700 bg-red-100 border-red-200',
        description: 'An error occurred during processing',
      },
    };
    return configs[status as keyof typeof configs] || configs.imported;
  };

  const statusConfig = getStatusConfig(project.status);
  const projectFramework =
    typeof project === 'object' && project !== null && 'framework' in project
      ? (project as { framework?: string }).framework
      : undefined;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };



  return (
    <PageLayout background="default">
      <Header
        title={project.name}
        subtitle={`${project.language || 'Project'} · ${project.filesCount || 0} files · ${formatBytes(project.projectSize || 0)}`}
        actions={
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        }
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {/* Status & Quick Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge
                className={`${statusConfig.color} flex items-center gap-1.5 px-3 py-1.5 border`}
              >
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
              {project.language && (
                <span className="text-sm text-gray-600">{project.language}</span>
              )}
              {projectFramework && (
                <span className="text-sm text-gray-600">· {projectFramework}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <FolderTree className="h-4 w-4 mr-2" />
                Files
              </Button>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Build Configuration History - Takes 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-ocean-600" />
                      Build Configurations
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {configSets.length > 0 && (
                        <Link href={`/project/${resolvedParams.id}/configs`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            View All
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      )}
                      <Link href={`/project/${resolvedParams.id}/configs/new`}>
                        <Button size="sm" className="bg-gradient-to-r from-ocean-600 to-ocean-500">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Create Configuration
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {configSets.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <div className="max-w-sm mx-auto">
                        <FileCode className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          No build configurations yet
                        </h3>
                        <p className="text-xs text-gray-500 mb-6">
                          Create your first build configuration to generate Docker, Kubernetes, or
                          other deployment files for your project.
                        </p>
                        <Link href={`/project/${resolvedParams.id}/configs/new`}>
                          <Button className="bg-gradient-to-r from-ocean-600 to-ocean-500">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Build Configuration
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {configSets.map((config, index) => (
                        <Link
                          key={config.id}
                          href={`/project/${resolvedParams.id}/configs/${config.id}`}
                        >
                          <div
                            className={`px-6 py-4 hover:bg-ocean-50/30 transition-colors cursor-pointer ${
                              index !== 0 ? 'border-t border-gray-100' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2 rounded-lg bg-ocean-50 flex-shrink-0">
                                  <FileCode className="h-4 w-4 text-ocean-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm truncate">
                                    v{config.version} - {config.type}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDate(config.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="flex-shrink-0">
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  View
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-shrink-0">
                                  <Rocket className="h-3.5 w-3.5 mr-1.5" />
                                  Deploy
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-blue-50 flex-shrink-0 mt-0.5">
                        <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900">Project imported</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatRelativeTime(project.createdAt)}
                        </p>
                      </div>
                    </div>
                    {configSets.slice(0, 5).map((config) => (
                      <div key={config.id} className="flex items-start gap-3">
                        <div className="p-1.5 rounded-md bg-purple-50 flex-shrink-0 mt-0.5">
                          <FileCode className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">
                            {config.type} configuration created
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatRelativeTime(config.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {project.updatedAt && project.createdAt !== project.updatedAt && (
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-md bg-gray-50 flex-shrink-0 mt-0.5">
                          <RefreshCw className="h-3.5 w-3.5 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">Project updated</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatRelativeTime(project.updatedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Project Details & Settings Sidebar */}
            <div className="space-y-6">
              {/* Project Overview Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Project Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-sm">
                  {/* Source Information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {project.sourceType === 'github' && <GitBranch className="h-3.5 w-3.5" />}
                      {project.sourceType === 'zip' && <Archive className="h-3.5 w-3.5" />}
                      Source
                    </div>
                    <div className="space-y-1.5">
                      {project.sourceUrl && project.sourceType !== 'zip' && (
                        <a
                          href={project.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-ocean-600 hover:text-ocean-700 hover:underline text-sm group"
                        >
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          <span className="truncate">View Repository</span>
                        </a>
                      )}
                      {project.sourceType === 'zip' && (
                        <div className="flex items-start gap-2">
                          <Archive className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600 break-all">{project.sourceUrl}</p>
                        </div>
                      )}
                      {project.sourceBranch && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <GitBranch className="h-3 w-3" />
                          <span>{project.sourceBranch}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Project Stats */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <Files className="h-3.5 w-3.5" />
                      Project Details
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <HardDrive className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Size</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatBytes(project.projectSize || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Files className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Files</p>
                          <p className="text-sm font-medium text-gray-900">
                            {project.filesCount || 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Imported</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(project.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <RefreshCw className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Updated</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(project.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Local Storage Path */}
                  {project.localPath && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <HardDrive className="h-3.5 w-3.5" />
                        Storage Location
                      </p>
                      <code className="text-xs bg-gray-50 px-2 py-1.5 rounded text-gray-700 block break-all border border-gray-200 font-mono">
                        {project.localPath}
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats Card */}
              <Card className="bg-gradient-to-br from-ocean-50 to-blue-50 border-ocean-100">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-ocean-600">{configSets.length}</div>
                      <div className="text-xs text-gray-600 mt-1">Configurations</div>
                    </div>
                    <div className="text-center border-l border-ocean-200">
                      <div className="text-3xl font-bold text-gray-400">0</div>
                      <div className="text-xs text-gray-600 mt-1">Deployments</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
