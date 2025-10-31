// Configuration related types
export interface ConfigSet {
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
