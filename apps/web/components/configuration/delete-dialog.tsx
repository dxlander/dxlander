import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Define types for our data
interface ConfigSet {
  id: string;
  projectId: string;
  analysisRunId?: string;
  userId: string;
  name: string;
  type: string;
  version: number;
  localPath?: string;
  status: string;
  progress?: number;
  generatedBy: string;
  aiModel?: string;
  description?: string;
  tags?: string;
  notes?: string;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
  fileCount?: number;
}

interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  localPath: string;
  gitOrigin?: string;
  gitBranch?: string;
  gitCommit?: string;
  filesCount?: number;
  status: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeleteConfigDialogProps {
  config: ConfigSet;
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteConfigDialog({
  config,
  project,
  open,
  onOpenChange,
  onSuccess,
}: DeleteConfigDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const expectedConfirmText = `${config.type} v${config.version}`;

  const deleteConfig = trpc.configs.delete.useMutation({
    onSuccess: () => {
      toast.success(`Configuration "${config.type} v${config.version}" deleted successfully`);
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete configuration');
    },
  });

  const handleDelete = () => {
    if (confirmText === expectedConfirmText) {
      deleteConfig.mutate({ id: config.id });
    }
  };

  const isDeleteDisabled = confirmText !== expectedConfirmText || deleteConfig.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-50">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            Delete Configuration
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the {config.type}{' '}
            configuration v{config.version} from project &quot;{project.name}&quot;.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Deleting this configuration will remove all generated files and deployment settings.
            Existing deployments using this configuration will not be affected, but you won&apos;t
            be able to redeploy with this configuration.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            To confirm, type <span className="font-mono font-bold">{expectedConfirmText}</span> in
            the box below:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedConfirmText}
            className={confirmText && confirmText !== expectedConfirmText ? 'border-red-500' : ''}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteConfig.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleteDisabled}
            className="min-w-[160px]"
          >
            {deleteConfig.isPending ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Deleting...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Configuration
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
