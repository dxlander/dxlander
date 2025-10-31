'use client';

import { DeleteConfigDialog } from '@/components/configuration/delete-dialog';
import { Header, PageLayout, Section } from '@/components/layouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import type { ConfigSet } from '@dxlander/shared';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCode,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@dxlander/shared/utils';
import { use, useState } from 'react';
import { toast } from 'sonner';

// Define types for our data
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BuildConfigurationsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfigSet | null>(null);

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = trpc.projects.get.useQuery({
    id: resolvedParams.id,
  });

  const {
    data: configSets = [],
    isLoading: configsLoading,
    refetch: refetchConfigs,
  } = trpc.configs.list.useQuery({
    projectId: resolvedParams.id,
  });

  const isLoading = projectLoading || configsLoading;

  if (isLoading) {
    return (
      <PageLayout background="default">
        <Section spacing="lg">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading configurations...</p>
            </div>
          </div>
        </Section>
      </PageLayout>
    );
  }

  if (projectError || !project) {
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



  const handleDeleteClick = (config: ConfigSet) => {
    setSelectedConfig(config);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSuccess = () => {
    // Refetch configurations after successful deletion
    refetchConfigs();
    toast.success('Configuration deleted successfully');
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      <Link href={`/project/${resolvedParams.id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </Link>
      <Link href={`/project/${resolvedParams.id}/configs/new`}>
        <Button size="sm" className="bg-gradient-to-r from-ocean-600 to-ocean-500">
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </Link>
    </div>
  );

  return (
    <PageLayout background="default">
      <Header
        title="Build Configurations"
        subtitle={project.name}
        badge={`${configSets.length} configs`}
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {configSets.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <FileCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No build configurations yet
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Generate your first build configuration from your project discovery results.
                </p>
                <Link href={`/project/${resolvedParams.id}/configs/new`}>
                  <Button size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Create First Configuration
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {configSets.map((config) => (
                <Card key={config.id} className="hover:border-ocean-300 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      {/* Config Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 rounded-xl bg-ocean-50 flex-shrink-0">
                          <FileCode className="h-6 w-6 text-ocean-600" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900 text-lg">
                              v{config.version} - {config.type}
                            </h4>
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {config.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                            <span>Created {formatRelativeTime(config.createdAt)}</span>
                          </div>

                          {/* Files - Note: Files are now stored in a separate table, will be shown in detail view */}
                          <p className="text-sm text-gray-500">Click to view configuration files</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link href={`/project/${resolvedParams.id}/configs/${config.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1.5" />
                            View
                          </Button>
                        </Link>
                        <Link href={`/project/${resolvedParams.id}/configs/${config.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm">
                          <Rocket className="h-4 w-4 mr-1.5" />
                          Deploy
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteClick(config)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Section>

      {selectedConfig && project && (
        <DeleteConfigDialog
          config={selectedConfig}
          project={project}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </PageLayout>
  );
}
