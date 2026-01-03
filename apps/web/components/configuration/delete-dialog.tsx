import React, { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import type { ConfigSet, SerializedProject } from '@dxlander/shared';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Use serialized project type from shared package
type Project = SerializedProject;

export interface DeleteConfigDialogProps {
  config: ConfigSet;
  project: Project | null;
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
  const expectedConfirmText = `${config.name}`;

  React.useEffect(() => {
    if (open) {
      setConfirmText('');
    }
  }, [open, config.id]);

  const deleteConfig = trpc.configs.delete.useMutation({
    onSuccess: () => {
      toast.success(`Configuration "${config.name}" deleted successfully`);
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

  // Handle the case where project might be null
  if (!project) {
    return null;
  }

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
            This action cannot be undone. This will permanently delete &quot;{config.name}&quot;
            from project &quot;{project.name}&quot;.
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
