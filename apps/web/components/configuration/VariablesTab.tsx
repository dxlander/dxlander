'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Key,
  Copy,
  CheckCircle2,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Code,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Container,
  Lock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trpc } from '@/lib/trpc';

interface EnvironmentVariable {
  key: string;
  description: string;
  value?: string;
  example?: string;
  integration?: string;
}

interface EnvironmentVariables {
  required?: EnvironmentVariable[];
  optional?: EnvironmentVariable[];
}

interface VariablesTabProps {
  environmentVariables?: EnvironmentVariables;
  onSave: (variables: EnvironmentVariables) => Promise<void>;
  configSetId?: string;
}

interface FlatVariable extends EnvironmentVariable {
  isRequired: boolean;
  originalIndex: number;
}

export function VariablesTab({ environmentVariables, onSave, configSetId }: VariablesTabProps) {
  const [variables, setVariables] = useState<FlatVariable[]>(() =>
    flattenVariables(environmentVariables)
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingVariable, setEditingVariable] = useState<FlatVariable | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newVariable, setNewVariable] = useState<FlatVariable>({
    key: '',
    description: '',
    value: '',
    example: '',
    isRequired: true,
    originalIndex: -1,
  });

  // Fetch config services to identify managed variables
  const { data: configServices = [] } = trpc.configServices.list.useQuery(
    { configSetId: configSetId || '' },
    { enabled: !!configSetId }
  );

  // Build a map of variable keys that are managed by config services
  const managedVariables = useMemo(() => {
    const managed = new Map<string, { serviceName: string; sourceMode: string }>();

    for (const service of configServices) {
      // Only mark as managed if the service has an active mode (not 'none')
      if (service.sourceMode === 'none') continue;

      for (const envVar of service.requiredEnvVars) {
        managed.set(envVar.key, {
          serviceName: service.name,
          sourceMode: service.sourceMode,
        });
      }
    }

    return managed;
  }, [configServices]);

  function flattenVariables(envVars?: EnvironmentVariables): FlatVariable[] {
    const flattened: FlatVariable[] = [];
    envVars?.required?.forEach((v, idx) => {
      flattened.push({ ...v, isRequired: true, originalIndex: idx });
    });
    envVars?.optional?.forEach((v, idx) => {
      flattened.push({ ...v, isRequired: false, originalIndex: idx });
    });
    return flattened;
  }

  function unflattenVariables(flatVars: FlatVariable[]): EnvironmentVariables {
    const required: EnvironmentVariable[] = [];
    const optional: EnvironmentVariable[] = [];

    flatVars.forEach((v) => {
      const { isRequired, originalIndex: _originalIndex, ...variable } = v;
      if (isRequired) {
        required.push(variable);
      } else {
        optional.push(variable);
      }
    });

    return { required, optional };
  }

  const handleCopyValue = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleValueVisibility = (key: string) => {
    setVisibleValues((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleRowClick = (variable: FlatVariable) => {
    const varId = `${variable.isRequired ? 'req' : 'opt'}-${variable.key}`;
    if (expandedId === varId) {
      setExpandedId(null);
      setEditingVariable(null);
    } else {
      setExpandedId(varId);
      // Pre-populate value with example if no value is set
      const editVar = { ...variable };
      if (!editVar.value && editVar.example) {
        editVar.value = editVar.example;
      }
      setEditingVariable(editVar);
    }
  };

  const handleSaveVariable = async () => {
    if (!editingVariable) return;
    setIsSaving(true);

    try {
      const updatedVariables = variables.map((v) => {
        const currentId = `${v.isRequired ? 'req' : 'opt'}-${v.key}`;
        const _editingId = `${editingVariable.isRequired ? 'req' : 'opt'}-${editingVariable.key}`;
        if (currentId === expandedId) {
          return editingVariable;
        }
        return v;
      });

      const wasRequiredChanged =
        variables.find((v) => `${v.isRequired ? 'req' : 'opt'}-${v.key}` === expandedId)
          ?.isRequired !== editingVariable.isRequired;

      if (wasRequiredChanged) {
        const originalVar = variables.find(
          (v) => `${v.isRequired ? 'req' : 'opt'}-${v.key}` === expandedId
        );
        if (originalVar) {
          const filteredVars = variables.filter(
            (v) => `${v.isRequired ? 'req' : 'opt'}-${v.key}` !== expandedId
          );
          filteredVars.push(editingVariable);
          setVariables(filteredVars);
          await onSave(unflattenVariables(filteredVars));
        }
      } else {
        setVariables(updatedVariables);
        await onSave(unflattenVariables(updatedVariables));
      }

      setExpandedId(null);
      setEditingVariable(null);
    } catch (error) {
      console.error('Failed to save variable:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setExpandedId(null);
    setEditingVariable(null);
  };

  const handleDeleteVariable = async (variable: FlatVariable) => {
    const updatedVariables = variables.filter(
      (v) => !(v.key === variable.key && v.isRequired === variable.isRequired)
    );
    setVariables(updatedVariables);
    await onSave(unflattenVariables(updatedVariables));
    setExpandedId(null);
    setEditingVariable(null);
  };

  const handleAddVariable = async () => {
    if (!newVariable.key.trim()) return;

    setIsSaving(true);
    try {
      const updatedVariables = [...variables, { ...newVariable, originalIndex: variables.length }];
      setVariables(updatedVariables);
      await onSave(unflattenVariables(updatedVariables));
      setNewVariable({
        key: '',
        description: '',
        value: '',
        example: '',
        isRequired: true,
        originalIndex: -1,
      });
      setIsAddingNew(false);
    } catch (error) {
      console.error('Failed to add variable:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const totalCount = variables.length;
  const requiredCount = variables.filter((v) => v.isRequired).length;
  const optionalCount = totalCount - requiredCount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-ocean-600" />
            <CardTitle>Environment Variables</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{totalCount} total</span>
              <span className="text-border">|</span>
              <span className="text-red-600">{requiredCount} required</span>
              <span className="text-border">|</span>
              <span className="text-blue-600">{optionalCount} optional</span>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddingNew(true)}
              className="bg-gradient-to-r from-ocean-600 to-ocean-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>
        </div>
        <CardDescription>Manage environment variables for your deployment</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Add New Variable Form */}
        {isAddingNew && (
          <div className="border-b border-border bg-ocean-50/50 p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <FloatingInput
                    label="Variable Name"
                    value={newVariable.key}
                    onChange={(e) =>
                      setNewVariable({
                        ...newVariable,
                        key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                      })
                    }
                    className="font-mono"
                  />
                </div>
                <Select
                  value={newVariable.isRequired ? 'required' : 'optional'}
                  onValueChange={(val) =>
                    setNewVariable({ ...newVariable, isRequired: val === 'required' })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={newVariable.description}
                onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                placeholder="Description (what is this variable for?)"
                rows={2}
                className="text-sm resize-none"
              />

              <FloatingInput
                label="Value"
                value={newVariable.value || ''}
                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                className="font-mono"
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewVariable({
                      key: '',
                      description: '',
                      value: '',
                      example: '',
                      isRequired: true,
                      originalIndex: -1,
                    });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddVariable}
                  disabled={!newVariable.key.trim() || isSaving}
                  className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Variables List */}
        {variables.length > 0 ? (
          <div className="divide-y divide-border">
            {variables.map((variable) => {
              const varId = `${variable.isRequired ? 'req' : 'opt'}-${variable.key}`;
              const isExpanded = expandedId === varId;
              const isValueVisible = visibleValues.has(variable.key);
              const hasActualValue = !!variable.value;
              const displayValue = variable.value || '';
              const managedInfo = managedVariables.get(variable.key);
              const isManaged = !!managedInfo;

              return (
                <div key={varId} className="group">
                  {/* Collapsed Row */}
                  <div
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      isExpanded ? 'bg-muted/50' : ''
                    } ${isManaged ? 'bg-ocean-50/30' : ''}`}
                    onClick={() => handleRowClick(variable)}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isManaged ? 'bg-ocean-100' : 'bg-muted'
                        }`}
                      >
                        {isManaged ? (
                          managedInfo.sourceMode === 'provision' ? (
                            <Container className="h-4 w-4 text-ocean-600" />
                          ) : (
                            <Lock className="h-4 w-4 text-ocean-600" />
                          )
                        ) : (
                          <Code className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Name & Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-semibold font-mono text-foreground">
                          {variable.key}
                        </code>
                        {isManaged && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-ocean-100 text-ocean-700 border border-ocean-200"
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            {managedInfo.serviceName}
                          </Badge>
                        )}
                        {variable.integration && !isManaged && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-ocean-100 text-ocean-700"
                          >
                            {variable.integration}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {isManaged
                          ? `Managed by ${managedInfo.serviceName} (${managedInfo.sourceMode})`
                          : variable.description || 'No description'}
                      </p>
                    </div>

                    {/* Value Preview */}
                    <div className="flex items-center gap-2">
                      {hasActualValue && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleValueVisibility(variable.key);
                          }}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          {isValueVisible ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      {hasActualValue && (
                        <code className="text-sm font-mono text-muted-foreground max-w-[200px] truncate">
                          {isValueVisible ? displayValue : '••••••••••••'}
                        </code>
                      )}
                      {!hasActualValue && variable.example && (
                        <span className="text-sm text-muted-foreground italic">
                          Example: {variable.example.substring(0, 20)}
                          {variable.example.length > 20 ? '...' : ''}
                        </span>
                      )}
                      {!hasActualValue && !variable.example && (
                        <span className="text-sm text-amber-600">Not set</span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <Badge
                      variant={variable.isRequired ? 'destructive' : 'secondary'}
                      className={`text-xs ${
                        variable.isRequired
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
                          : 'bg-ocean-100 dark:bg-ocean-900 text-ocean-700 dark:text-ocean-300 hover:bg-ocean-100 dark:hover:bg-ocean-900'
                      }`}
                    >
                      {variable.isRequired ? 'Required' : 'Optional'}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {hasActualValue && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyValue(displayValue, variable.key);
                          }}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          {copiedKey === variable.key ? (
                            <CheckCircle2 className="h-4 w-4 text-ocean-600 dark:text-ocean-400" />
                          ) : (
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRowClick(variable)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteVariable(variable)}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Expand Indicator */}
                      <div className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Edit Form */}
                  {isExpanded && editingVariable && (
                    <div
                      className={`px-6 pb-6 border-t border-border ${isManaged ? 'bg-ocean-50/50' : 'bg-muted/50'}`}
                    >
                      <div className="pt-4 space-y-4">
                        {/* Managed Variable Warning */}
                        {isManaged && (
                          <div className="flex items-start gap-3 p-3 bg-ocean-100/50 rounded-lg border border-ocean-200">
                            <Lock className="h-5 w-5 text-ocean-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-ocean-800">
                                Managed by {managedInfo.serviceName}
                              </p>
                              <p className="text-xs text-ocean-600 mt-0.5">
                                This variable is controlled by the {managedInfo.serviceName} service
                                (
                                {managedInfo.sourceMode === 'provision'
                                  ? 'provisioned container'
                                  : 'managed credentials'}
                                ). To modify it, go to the Services tab.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Name Field */}
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Name
                          </label>
                          <FloatingInput
                            label=""
                            value={editingVariable.key}
                            onChange={(e) =>
                              setEditingVariable({
                                ...editingVariable,
                                key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                              })
                            }
                            disabled={isManaged}
                            className={`font-mono ${isManaged ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
                          />
                        </div>

                        {/* Value Field */}
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Value
                          </label>
                          <Textarea
                            value={isManaged ? '••••••••••••' : editingVariable.value || ''}
                            onChange={(e) =>
                              setEditingVariable({ ...editingVariable, value: e.target.value })
                            }
                            placeholder={
                              isManaged
                                ? 'Value is managed by integration'
                                : 'Enter the value for this variable'
                            }
                            rows={3}
                            disabled={isManaged}
                            className={`text-sm font-mono resize-none ${isManaged ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
                          />
                          {!isManaged && editingVariable.example && !editingVariable.value && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Example:{' '}
                              <code className="bg-muted px-1 rounded">
                                {editingVariable.example}
                              </code>
                            </p>
                          )}
                        </div>

                        {/* Description Field */}
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Description
                          </label>
                          <FloatingInput
                            label=""
                            value={editingVariable.description}
                            onChange={(e) =>
                              setEditingVariable({
                                ...editingVariable,
                                description: e.target.value,
                              })
                            }
                            disabled={isManaged}
                            className={isManaged ? 'bg-muted cursor-not-allowed' : 'bg-background'}
                          />
                        </div>

                        {/* Type Selection */}
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            Type
                          </label>
                          <Select
                            value={editingVariable.isRequired ? 'required' : 'optional'}
                            onValueChange={(val) =>
                              setEditingVariable({
                                ...editingVariable,
                                isRequired: val === 'required',
                              })
                            }
                            disabled={isManaged}
                          >
                            <SelectTrigger
                              className={`w-full ${isManaged ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="required">Required</SelectItem>
                              <SelectItem value="optional">Optional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between pt-2">
                          {isManaged ? (
                            <div />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVariable(variable)}
                              className="text-red-600 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          )}
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                              {isManaged ? 'Close' : 'Cancel'}
                            </Button>
                            {!isManaged && (
                              <Button
                                size="sm"
                                onClick={handleSaveVariable}
                                disabled={isSaving || !editingVariable.key.trim()}
                                className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Key className="h-16 w-16 text-border mx-auto mb-4" />
            <p className="text-muted-foreground text-lg font-medium mb-2">
              No environment variables
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Add environment variables to configure your deployment
            </p>
            <Button
              size="sm"
              onClick={() => setIsAddingNew(true)}
              className="bg-gradient-to-r from-ocean-600 to-ocean-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
