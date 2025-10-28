import { Activity, AlertTriangle, FolderOpen, Rocket, Settings, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'next/navigation';

export interface DeleteProjectDialogProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    filesCount?: number | null;
    configsCount?: number | null;
    deploymentsCount?: number | null;
    analysisRunsCount?: number | null;
    createdAt: Date | string;
    status: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({ project, open, onOpenChange }: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const router = useRouter();

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: (data) => {
      toast.success(`Project "${data.deletedProject.name}" deleted successfully`);
      onOpenChange(false);
      // Just refresh the current page to update the project list
      router.refresh();
      // Force a full page reload if refresh doesn't update the list
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete project');
      // Don't close dialog on error so user can try again
    },
  });

  const handleDelete = () => {
    if (confirmText === project.name) {
      deleteProject.mutate({ id: project.id });
    }
  };

  const isDeleteDisabled = confirmText !== project.name || deleteProject.isPending;

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Project
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the project and all
            associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Info Card */}
          <div className="rounded-lg border bg-ocean-50/50 p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-lg text-black">{project.name}</h4>
                {project.description && (
                  <p
                    className="text-sm text-ocean-700 overflow-hidden"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-ocean-600">
                  <span>Created {formatDate(project.createdAt)}</span>
                  <Badge
                    variant="secondary"
                    data-testid="project-status-badge"
                    className={`
                      pointer-events-none
                      ${
                        project.status === 'imported'
                          ? 'text-blue-600 bg-blue-100'
                          : project.status === 'discovering' || project.status === 'analyzing'
                            ? 'text-ocean-600 bg-ocean-100'
                            : project.status === 'discovered' || project.status === 'analyzed'
                              ? 'text-green-600 bg-green-100'
                              : project.status === 'configured'
                                ? 'text-purple-600 bg-purple-100'
                                : project.status === 'deployed'
                                  ? 'text-indigo-600 bg-indigo-100'
                                  : project.status === 'failed'
                                    ? 'text-red-600 bg-red-100'
                                    : 'text-gray-600 bg-gray-100'
                      }
                    `}
                  >
                    {project.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Project Stats */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4 text-ocean-600" />
                <span className="text-ocean-800">
                  {formatNumber(project.filesCount || 0)} files
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-ocean-600" />
                <span className="text-ocean-800">
                  {formatNumber(project.configsCount || 0)} configs
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-ocean-600" />
                <span className="text-ocean-800">
                  {formatNumber(project.analysisRunsCount || 0)} analyses
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Rocket className="h-4 w-4 text-ocean-600" />
                <span className="text-ocean-800">
                  {formatNumber(project.deploymentsCount || 0)} deployments
                </span>
              </div>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-semibold">Warning: This will permanently delete:</p>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                <li>All project files and source code</li>
                <li>
                  Generated configurations ({formatNumber(project.configsCount || 0)} config sets)
                </li>
                <li>Deployment history and settings</li>
                <li>Analysis results and insights</li>
                <li>Build history and logs</li>
              </ul>
              <p className="mt-2 text-xs">
                This action cannot be reversed. Please make sure you have backups if needed.
              </p>
            </AlertDescription>
          </Alert>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label htmlFor="confirm" className="text-sm font-medium">
              Type the project name to confirm deletion:
            </label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={project.name}
              className="w-full focus:ring-2 focus:ring-destructive focus:border-destructive"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Enter <span className="font-mono bg-ocean-100 px-1 rounded">{project.name}</span> to
              enable deletion
            </p>
          </div>

          {/* Error State */}
          {deleteProject.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{deleteProject.error.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteProject.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleteDisabled}
            className="min-w-[120px]"
          >
            {deleteProject.isPending ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Project
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
