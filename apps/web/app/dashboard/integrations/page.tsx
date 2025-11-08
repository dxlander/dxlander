'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { IconWrapper } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, FloatingInput } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  Key,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Field {
  key: string;
  value: string;
}

interface IntegrationFormData {
  name: string;
  service: string;
  fields: Field[];
}

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewIntegrationDialog, setShowNewIntegrationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState<IntegrationFormData>({
    name: '',
    service: '',
    fields: [{ key: '', value: '' }],
  });

  // tRPC queries and mutations
  const { data: integrations = [], isLoading, refetch } = trpc.integrations.list.useQuery();

  const createMutation = trpc.integrations.create.useMutation({
    onSuccess: () => {
      toast.success('Integration created successfully');
      refetch();
      setShowNewIntegrationDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.integrations.update.useMutation({
    onSuccess: () => {
      toast.success('Integration updated successfully');
      refetch();
      setShowEditDialog(false);
      setSelectedIntegration(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.integrations.delete.useMutation({
    onSuccess: () => {
      toast.success('Integration deleted successfully');
      refetch();
      setShowDeleteDialog(false);
      setSelectedIntegration(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { data: editFields } = trpc.integrations.getFields.useQuery(
    { id: selectedIntegration?.id || '' },
    { enabled: !!selectedIntegration && showEditDialog }
  );

  const resetForm = () => {
    setFormData({
      name: '',
      service: '',
      fields: [{ key: '', value: '' }],
    });
  };

  const addField = () => {
    setFormData({
      ...formData,
      fields: [...formData.fields, { key: '', value: '' }],
    });
  };

  const removeField = (index: number) => {
    const newFields = formData.fields.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      fields: newFields.length > 0 ? newFields : [{ key: '', value: '' }],
    });
  };

  const updateField = (index: number, field: 'key' | 'value', value: string) => {
    const newFields = [...formData.fields];
    newFields[index][field] = value;
    setFormData({ ...formData, fields: newFields });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.service) {
      toast.error('Please enter integration name and service type');
      return;
    }

    const validFields = formData.fields.filter((f) => f.key && f.value);
    if (validFields.length === 0) {
      toast.error('Please add at least one field with both key and value');
      return;
    }

    createMutation.mutate({
      name: formData.name,
      service: formData.service.toUpperCase(),
      fields: validFields,
    });
  };

  const handleUpdate = () => {
    if (!selectedIntegration) return;

    const validFields = formData.fields.filter((f) => f.key && f.value);

    updateMutation.mutate({
      id: selectedIntegration.id,
      name: formData.name || undefined,
      fields: validFields.length > 0 ? validFields : undefined,
    });
  };

  const handleDelete = () => {
    if (!selectedIntegration) return;
    deleteMutation.mutate({ id: selectedIntegration.id });
  };

  const handleEditClick = async (integration: any) => {
    setSelectedIntegration(integration);
    setFormData({
      name: integration.name,
      service: integration.service,
      fields: [{ key: '', value: '' }],
    });
    setShowEditDialog(true);
  };

  const handleDeleteClick = (integration: any) => {
    setSelectedIntegration(integration);
    setShowDeleteDialog(true);
  };

  // Load fields when edit dialog opens
  useState(() => {
    if (editFields && showEditDialog) {
      setFormData((prev) => ({
        ...prev,
        fields: editFields.length > 0 ? editFields : [{ key: '', value: '' }],
      }));
    }
  });

  const filteredIntegrations = integrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.service.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const headerActions = (
    <div className="flex items-center space-x-3">
      <Button onClick={() => setShowNewIntegrationDialog(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Integration
      </Button>
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );

  return (
    <PageLayout background="default">
      <Header
        title="Integrations"
        subtitle="Manage API keys, service accounts, and third-party credentials"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {/* Security Info Card */}
          <Card className="border-ocean-200 bg-gradient-to-r from-ocean-50/50 to-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ocean-100 rounded-lg">
                  <ShieldCheck className="h-6 w-6 text-ocean-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Enterprise-Grade Security</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>AES-256-GCM Encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Dynamic field support for any service</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="p-16 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-ocean-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading integrations...</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && filteredIntegrations.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <IconWrapper variant="default" size="xl" className="mx-auto mb-4">
                  <Key className="h-12 w-12" />
                </IconWrapper>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No integrations found' : 'No integrations yet'}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search or add a new integration'
                    : 'Add your first integration to securely store credentials for any third-party service. Define custom fields for maximum flexibility.'}
                </p>
                <Button size="lg" onClick={() => setShowNewIntegrationDialog(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Integration
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Integrations Grid */}
          {!isLoading && filteredIntegrations.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredIntegrations.map((integration) => (
                <Card
                  key={integration.id}
                  className="hover:shadow-elegant transition-all hover:border-ocean-300"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <IconWrapper variant="default" size="md" className="flex-shrink-0">
                            <Key className="h-5 w-5" />
                          </IconWrapper>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {integration.name}
                              </h4>
                              <Badge variant="secondary" className="flex-shrink-0">
                                {integration.service}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Lock className="h-3.5 w-3.5" />
                              <span>AES-256-GCM Encrypted</span>
                            </div>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEditClick(integration)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteClick(integration)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Error Message */}
                      {integration.lastError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600">{integration.lastError}</p>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Used</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {integration.usageCount}x
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Created</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatDistanceToNow(new Date(integration.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Used</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {integration.lastUsed
                              ? formatDistanceToNow(new Date(integration.lastUsed), {
                                  addSuffix: true,
                                })
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Add Integration Dialog */}
      <Dialog open={showNewIntegrationDialog} onOpenChange={setShowNewIntegrationDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Add New Integration</DialogTitle>
            <DialogDescription>
              Securely store credentials for any third-party service. All fields are encrypted with
              AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <FloatingInput
              label="Integration Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              leftIcon={<Key className="h-4 w-4" />}
              placeholder="e.g., Production Supabase"
            />

            <FloatingInput
              label="Service Type"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              leftIcon={<Key className="h-4 w-4" />}
              placeholder="e.g., SUPABASE, STRIPE, CUSTOM_API"
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-900">Credential Fields</label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {formData.fields.map((field, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Field name (e.g., API_KEY, URL)"
                      value={field.key}
                      onChange={(e) => updateField(index, 'key', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="password"
                      placeholder="Field value"
                      value={field.value}
                      onChange={(e) => updateField(index, 'value', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(index)}
                    disabled={formData.fields.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-4 bg-ocean-50 border border-ocean-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-ocean-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Automatic Encryption</h4>
                  <p className="text-sm text-gray-700">
                    All field values will be encrypted using AES-256-GCM before storage.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewIntegrationDialog(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Add Integration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Integration Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Integration</DialogTitle>
            <DialogDescription>
              Update integration name or credentials. Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <FloatingInput
              label="Integration Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              leftIcon={<Key className="h-4 w-4" />}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-900">
                  Update Credentials (optional)
                </label>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>

              {formData.fields.map((field, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => updateField(index, 'key', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="password"
                      placeholder="Field value"
                      value={field.value}
                      onChange={(e) => updateField(index, 'value', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(index)}
                    disabled={formData.fields.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                Leave fields empty to keep existing credentials
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedIntegration(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Integration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedIntegration?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedIntegration(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
