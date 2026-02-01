'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FloatingInput } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Database,
  Key,
  CheckCircle2,
  Plus,
  Loader2,
  Mail,
  CreditCard,
  Cloud,
  Server,
  Globe,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Container,
  FileKey,
  X,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  HardDrive,
  Wifi,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { ServiceSourceMode, ServiceCategory } from '@dxlander/shared';

const PROVISIONABLE_CATEGORIES: ServiceCategory[] = [
  'database',
  'cache',
  'search',
  'storage',
  'queue',
];

const SOURCE_MODE_INFO: Record<ServiceSourceMode, { label: string; description: string }> = {
  provision: {
    label: 'Use Container',
    description: 'Use the container service already configured in docker-compose',
  },
  external: {
    label: 'Use External Service',
    description: 'Use external service with your own credentials',
  },
  none: {
    label: 'Skip',
    description: 'This service is not needed or will be configured later',
  },
};

interface DetectedService {
  name: string;
  type: string;
  detectedFrom: string;
  optional?: boolean;
  requiredKeys: string[];
  notes?: string;
}

interface ServicesSummary {
  integrations?: {
    detected?: DetectedService[];
  };
}

interface ServicesTabProps {
  summary: ServicesSummary | null;
  servicesCount: number;
  configSetId: string;
}

const getCategoryIcon = (category: ServiceCategory) => {
  switch (category) {
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'cache':
      return <Cpu className="h-4 w-4" />;
    case 'search':
      return <Globe className="h-4 w-4" />;
    case 'storage':
      return <HardDrive className="h-4 w-4" />;
    case 'queue':
      return <Wifi className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'payment':
      return <CreditCard className="h-4 w-4" />;
    case 'auth':
      return <Key className="h-4 w-4" />;
    case 'monitoring':
      return <Server className="h-4 w-4" />;
    case 'ai':
      return <Cpu className="h-4 w-4" />;
    case 'api':
      return <Cloud className="h-4 w-4" />;
    default:
      return <Key className="h-4 w-4" />;
  }
};

const getSourceModeIcon = (mode: ServiceSourceMode) => {
  switch (mode) {
    case 'provision':
      return <Container className="h-4 w-4" />;
    case 'external':
      return <FileKey className="h-4 w-4" />;
    case 'none':
      return <X className="h-4 w-4" />;
  }
};

const getSourceModeLabel = (mode: ServiceSourceMode) => {
  switch (mode) {
    case 'provision':
      return 'Use Container';
    case 'external':
      return 'Use External';
    case 'none':
      return 'Skip';
  }
};

const getSourceModeColor = (mode: ServiceSourceMode) => {
  switch (mode) {
    case 'provision':
      return 'bg-ocean-100 dark:bg-ocean-900 text-ocean-700 dark:text-ocean-300';
    case 'external':
      return 'bg-ocean-100 text-ocean-700';
    case 'none':
      return 'bg-muted text-muted-foreground';
  }
};

export function ServicesTab({
  summary,
  servicesCount: _servicesCount,
  configSetId,
}: ServicesTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [customCredentials, setCustomCredentials] = useState<Record<string, string>>({});
  const [showCredentials, setShowCredentials] = useState<Set<string>>(new Set());
  // Use ref instead of state to prevent React Strict Mode double-invocation issues
  const hasAttemptedCreateRef = useRef(false);

  const {
    data: sources = [],
    isLoading: sourcesLoading,
    refetch: refetchSources,
  } = trpc.configServices.list.useQuery({ configSetId }, { enabled: !!configSetId });

  const { data: categories = [] } = trpc.configServices.getCategories.useQuery();

  const createFromDetectedMutation = trpc.configServices.createFromDetected.useMutation({
    onSuccess: () => {
      toast.success('Services created');
      refetchSources();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createMutation = trpc.configServices.create.useMutation({
    onSuccess: () => {
      toast.success('Service added');
      refetchSources();
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.configServices.update.useMutation({
    onSuccess: () => {
      toast.success('Service updated');
      refetchSources();
      setEditingSource(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.configServices.delete.useMutation({
    onSuccess: () => {
      toast.success('Service deleted');
      refetchSources();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const configureExternalMutation = trpc.configServices.configureExternal.useMutation({
    onSuccess: () => {
      toast.success('Credentials saved');
      refetchSources();
      setCustomCredentials({});
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    // Only attempt to create services once - prevents infinite loop if creation fails
    // Using ref instead of state to prevent React Strict Mode double-invocation
    if (
      sources.length === 0 &&
      summary?.integrations?.detected &&
      summary.integrations.detected.length > 0 &&
      !sourcesLoading &&
      !createFromDetectedMutation.isPending &&
      !hasAttemptedCreateRef.current
    ) {
      hasAttemptedCreateRef.current = true;
      createFromDetectedMutation.mutate({
        configSetId,
        detected: summary.integrations.detected,
      });
    }
  }, [sources, summary, sourcesLoading, configSetId, createFromDetectedMutation]);

  const handleSourceModeChange = (serviceId: string, mode: ServiceSourceMode) => {
    updateMutation.mutate({ serviceId, sourceMode: mode });
  };

  const handleToggleExpand = (serviceId: string) => {
    setExpandedId(expandedId === serviceId ? null : serviceId);
  };

  const toggleCredentialVisibility = (key: string) => {
    setShowCredentials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveExternalCredentials = (serviceId: string) => {
    if (Object.keys(customCredentials).length === 0) {
      toast.error('Please enter at least one credential');
      return;
    }
    const credentials: Record<string, { type: 'manual'; value: string }> = {};
    for (const [key, value] of Object.entries(customCredentials)) {
      if (value) {
        credentials[key] = { type: 'manual', value };
      }
    }
    configureExternalMutation.mutate({ serviceId, credentials });
  };

  const handleAddService = (name: string, category: ServiceCategory) => {
    createMutation.mutate({
      configSetId,
      name,
      category,
      detectedFrom: 'Manually added',
      isRequired: false,
      sourceMode: 'external',
    });
  };

  if (sourcesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-ocean-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-ocean-600" />
              <h3 className="text-lg font-semibold">Services</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{sources.length} total</span>
                <span className="text-border">|</span>
                <span className="text-red-600">
                  {sources.filter((s) => s.isRequired).length} required
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-ocean-600 to-ocean-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
          </div>
          <CardDescription>
            Configure how each service gets its credentials for deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sources.length > 0 ? (
            <div className="divide-y divide-border">
              {sources.map((source) => {
                const isExpanded = expandedId === source.id;
                const categoryInfo = categories.find((c) => c.value === source.category);

                return (
                  <div key={source.id} className="group">
                    <div
                      className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        isExpanded ? 'bg-muted/50' : ''
                      }`}
                      onClick={() => handleToggleExpand(source.id)}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-ocean-100 flex items-center justify-center text-ocean-600">
                          {getCategoryIcon(source.category)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{source.name}</span>
                          {source.isEdited && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-100 text-amber-700"
                            >
                              Edited
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {categoryInfo?.label || source.category}
                          {source.detectedFrom && ` - ${source.detectedFrom}`}
                        </p>
                      </div>

                      <Badge
                        variant={source.isRequired ? 'destructive' : 'secondary'}
                        className={`text-xs ${
                          source.isRequired
                            ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
                            : 'bg-ocean-100 dark:bg-ocean-900 text-ocean-700 dark:text-ocean-300 hover:bg-ocean-100 dark:hover:bg-ocean-900'
                        }`}
                      >
                        {source.isRequired ? 'Required' : 'Optional'}
                      </Badge>

                      <Badge className={`text-xs ${getSourceModeColor(source.sourceMode)}`}>
                        {getSourceModeIcon(source.sourceMode)}
                        <span className="ml-1">{getSourceModeLabel(source.sourceMode)}</span>
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingSource(source.id)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate({ serviceId: source.id })}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6 bg-muted/50 border-t border-border">
                        <div className="pt-4 space-y-4">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-3 block">
                              How should this service be configured?
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Provision - show for provisionable categories */}
                              {PROVISIONABLE_CATEGORIES.includes(source.category) && (
                                <button
                                  onClick={() => handleSourceModeChange(source.id, 'provision')}
                                  className={`flex flex-col items-start gap-1 p-4 rounded-lg border transition-colors text-left ${
                                    source.sourceMode === 'provision'
                                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                      : 'border-border hover:border-blue-300 hover:bg-blue-50/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Container className="h-5 w-5 text-blue-600" />
                                    <span className="font-medium text-foreground">
                                      {SOURCE_MODE_INFO.provision.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground ml-7">
                                    {SOURCE_MODE_INFO.provision.description}
                                  </p>
                                </button>
                              )}

                              {/* External - enter manually or load from Secret Manager */}
                              <button
                                onClick={() => handleSourceModeChange(source.id, 'external')}
                                className={`flex flex-col items-start gap-1 p-4 rounded-lg border transition-colors text-left ${
                                  source.sourceMode === 'external'
                                    ? 'border-ocean-500 bg-ocean-50 ring-2 ring-ocean-200'
                                    : 'border-border hover:border-ocean-300 hover:bg-ocean-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <FileKey className="h-5 w-5 text-ocean-600" />
                                  <span className="font-medium text-foreground">
                                    {SOURCE_MODE_INFO.external.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-7">
                                  {SOURCE_MODE_INFO.external.description}
                                </p>
                              </button>

                              {/* Skip - always available */}
                              <button
                                onClick={() => handleSourceModeChange(source.id, 'none')}
                                className={`flex flex-col items-start gap-1 p-4 rounded-lg border transition-colors text-left ${
                                  source.sourceMode === 'none'
                                    ? 'border-gray-500 bg-muted ring-2 ring-gray-300'
                                    : 'border-border hover:border-gray-400 hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <X className="h-5 w-5 text-muted-foreground" />
                                  <span className="font-medium text-foreground">
                                    {SOURCE_MODE_INFO.none.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-7">
                                  {SOURCE_MODE_INFO.none.description}
                                </p>
                              </button>
                            </div>
                          </div>

                          {source.sourceMode === 'provision' && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                              <div className="flex items-start gap-3">
                                <Container className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div>
                                  <h4 className="font-medium text-blue-900 mb-1">Container Mode</h4>
                                  <p className="text-sm text-blue-700 mb-3">
                                    This service will use the container configured in
                                    docker-compose. Credentials will be auto-generated during
                                    deployment.
                                  </p>
                                  <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>No configuration needed</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {source.sourceMode === 'external' && (
                            <div className="p-4 bg-ocean-50 rounded-lg border border-ocean-100">
                              <h4 className="font-medium text-ocean-900 mb-3">
                                External Service Credentials
                              </h4>
                              {source.hasSecretCredentials ? (
                                <div className="text-sm text-ocean-700">
                                  <p className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Credentials saved (encrypted)
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                      setCustomCredentials({});
                                      source.requiredEnvVars.forEach((env) => {
                                        setCustomCredentials((prev) => ({
                                          ...prev,
                                          [env.key]: '',
                                        }));
                                      });
                                    }}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Update Credentials
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-sm text-ocean-700 mb-3">
                                    Enter credentials for your external service:
                                  </p>
                                  {source.requiredEnvVars.length > 0 ? (
                                    source.requiredEnvVars.map((envVar) => (
                                      <div key={envVar.key}>
                                        <div className="flex gap-2">
                                          <FloatingInput
                                            label={envVar.key}
                                            type={
                                              showCredentials.has(envVar.key) ? 'text' : 'password'
                                            }
                                            value={customCredentials[envVar.key] || ''}
                                            onChange={(e) =>
                                              setCustomCredentials((prev) => ({
                                                ...prev,
                                                [envVar.key]: e.target.value,
                                              }))
                                            }
                                            className="flex-1 bg-background"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleCredentialVisibility(envVar.key)}
                                          >
                                            {showCredentials.has(envVar.key) ? (
                                              <EyeOff className="h-4 w-4" />
                                            ) : (
                                              <Eye className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>
                                        {envVar.description && (
                                          <p className="text-xs text-ocean-600 mt-1">
                                            {envVar.description}
                                          </p>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div>
                                      <FloatingInput
                                        label="Key"
                                        value={Object.keys(customCredentials)[0] || ''}
                                        onChange={(e) => {
                                          const oldKey = Object.keys(customCredentials)[0];
                                          const value = customCredentials[oldKey] || '';
                                          setCustomCredentials({ [e.target.value]: value });
                                        }}
                                        className="mb-2 bg-background"
                                      />
                                      <FloatingInput
                                        label="Value"
                                        type="password"
                                        value={Object.values(customCredentials)[0] || ''}
                                        onChange={(e) => {
                                          const key =
                                            Object.keys(customCredentials)[0] || 'API_KEY';
                                          setCustomCredentials({ [key]: e.target.value });
                                        }}
                                        className="bg-background"
                                      />
                                    </div>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveExternalCredentials(source.id)}
                                    disabled={configureExternalMutation.isPending}
                                    className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                                  >
                                    {configureExternalMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Credentials
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {source.sourceMode === 'none' && (
                            <div className="p-4 bg-muted rounded-lg border border-border">
                              <p className="text-sm text-muted-foreground">
                                This service will be skipped during deployment. No credentials will
                                be injected.
                              </p>
                            </div>
                          )}

                          {source.notes && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <p className="text-sm text-amber-800">
                                <strong>Note:</strong> {source.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg font-medium mb-2">No services detected</p>
              <p className="text-muted-foreground text-sm mb-4">
                This project doesn&apos;t require external services, or you can add them manually.
              </p>
              <Button
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="bg-gradient-to-r from-ocean-600 to-ocean-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Manually add a service that wasn&apos;t detected automatically.
            </DialogDescription>
          </DialogHeader>
          <AddServiceForm
            categories={categories}
            onAdd={handleAddService}
            isLoading={createMutation.isPending}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <EditServiceDialog
        source={sources.find((s) => s.id === editingSource) || null}
        categories={categories}
        isOpen={!!editingSource}
        onClose={() => setEditingSource(null)}
        onSave={(updates) => {
          if (editingSource) {
            updateMutation.mutate({ serviceId: editingSource, ...updates });
          }
        }}
        isLoading={updateMutation.isPending}
      />
    </div>
  );
}

function AddServiceForm({
  categories,
  onAdd,
  isLoading,
  onCancel,
}: {
  categories: Array<{ value: ServiceCategory; label: string; isProvisionable: boolean }>;
  onAdd: (name: string, category: ServiceCategory) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('other');

  return (
    <div className="space-y-4 py-4">
      <div>
        <FloatingInput
          label="Service Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Category</label>
        <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => onAdd(name, category)}
          disabled={!name.trim() || isLoading}
          className="bg-gradient-to-r from-ocean-600 to-ocean-500"
        >
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Add Service
        </Button>
      </DialogFooter>
    </div>
  );
}

function EditServiceDialog({
  source,
  categories,
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  source: {
    id: string;
    name: string;
    category: ServiceCategory;
    isRequired: boolean;
    isProvisionable: boolean;
    notes: string | null;
    requiredEnvVars: Array<{ key: string; description?: string; example?: string }>;
  } | null;
  categories: Array<{ value: ServiceCategory; label: string; isProvisionable: boolean }>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: {
    name?: string;
    category?: ServiceCategory;
    isRequired?: boolean;
    isProvisionable?: boolean;
    notes?: string;
    requiredEnvVars?: Array<{ key: string; description?: string; example?: string }>;
  }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('other');
  const [isRequired, setIsRequired] = useState(true);
  const [isProvisionable, setIsProvisionable] = useState(false);
  const [notes, setNotes] = useState('');
  const [envVars, setEnvVars] = useState<
    Array<{ key: string; description?: string; example?: string }>
  >([]);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setCategory(source.category);
      setIsRequired(source.isRequired);
      setIsProvisionable(source.isProvisionable);
      setNotes(source.notes || '');
      setEnvVars(source.requiredEnvVars || []);
    }
  }, [source]);

  if (!source) return null;

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, key: string, value: string) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [key]: value };
    setEnvVars(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            Modify service details and required environment variables.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <FloatingInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ServiceCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Required</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isProvisionable}
                onChange={(e) => setIsProvisionable(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Can be provisioned</span>
            </label>
          </div>

          <div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Environment Variables</label>
              <Button variant="ghost" size="sm" onClick={handleAddEnvVar}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {envVars.map((env, index) => (
                <div key={index} className="flex gap-2">
                  <FloatingInput
                    label="Key"
                    value={env.key}
                    onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveEnvVar(index)}
                    className="text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                name,
                category,
                isRequired,
                isProvisionable,
                notes,
                requiredEnvVars: envVars,
              })
            }
            disabled={isLoading}
            className="bg-gradient-to-r from-ocean-600 to-ocean-500"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
