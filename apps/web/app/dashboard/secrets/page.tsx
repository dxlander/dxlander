'use client';

import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Database,
  Mail,
  CreditCard,
  Cloud,
  Server,
  Globe,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { SerializedSecret, SecretField } from '@dxlander/shared';

// Service type options with descriptions
const SERVICE_TYPES = [
  {
    value: 'DATABASE',
    label: 'Database',
    description: 'PostgreSQL, MySQL, MongoDB, etc.',
    icon: Database,
  },
  {
    value: 'EMAIL',
    label: 'Email Service',
    description: 'SendGrid, Mailgun, AWS SES, etc.',
    icon: Mail,
  },
  {
    value: 'PAYMENT',
    label: 'Payment Gateway',
    description: 'Stripe, PayPal, Square, etc.',
    icon: CreditCard,
  },
  {
    value: 'CLOUD',
    label: 'Cloud Provider',
    description: 'AWS, Google Cloud, Azure, etc.',
    icon: Cloud,
  },
  {
    value: 'BACKEND',
    label: 'Backend Service',
    description: 'Supabase, Firebase, etc.',
    icon: Server,
  },
  { value: 'API', label: 'External API', description: 'Custom REST/GraphQL APIs', icon: Globe },
  { value: 'OTHER', label: 'Other', description: 'Other third-party services', icon: Key },
] as const;

// Use shared types
type Secret = SerializedSecret;
type Field = SecretField;

interface SecretFormData {
  name: string;
  service: string;
  fields: Field[];
}

export default function SecretsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewSecretDialog, setShowNewSecretDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);

  // Form state
  const [formData, setFormData] = useState<SecretFormData>({
    name: '',
    service: '',
    fields: [{ key: '', value: '' }],
  });

  // tRPC queries and mutations
  const { data: secrets = [], isLoading, refetch } = trpc.secrets.list.useQuery();

  const createMutation = trpc.secrets.create.useMutation({
    onSuccess: () => {
      toast.success('Secret created successfully');
      refetch();
      setShowNewSecretDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.secrets.update.useMutation({
    onSuccess: () => {
      toast.success('Secret updated successfully');
      refetch();
      setShowEditDialog(false);
      setSelectedSecret(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.secrets.delete.useMutation({
    onSuccess: () => {
      toast.success('Secret deleted successfully');
      refetch();
      setShowDeleteDialog(false);
      setSelectedSecret(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { data: editFields } = trpc.secrets.getFields.useQuery(
    { id: selectedSecret?.id || '' },
    { enabled: !!selectedSecret && showEditDialog }
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
      toast.error('Please enter secret name and service type');
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
    if (!selectedSecret) return;

    const validFields = formData.fields.filter((f) => f.key && f.value);

    updateMutation.mutate({
      id: selectedSecret.id,
      name: formData.name || undefined,
      fields: validFields.length > 0 ? validFields : undefined,
    });
  };

  const handleDelete = () => {
    if (!selectedSecret) return;
    deleteMutation.mutate({ id: selectedSecret.id });
  };

  const handleEditClick = async (secret: Secret) => {
    setSelectedSecret(secret);
    setFormData({
      name: secret.name,
      service: secret.service,
      fields: [{ key: '', value: '' }],
    });
    setShowEditDialog(true);
  };

  const handleDeleteClick = (secret: Secret) => {
    setSelectedSecret(secret);
    setShowDeleteDialog(true);
  };

  // Load fields when edit dialog opens
  useEffect(() => {
    if (editFields && showEditDialog) {
      setFormData((prev) => ({
        ...prev,
        fields: editFields.length > 0 ? editFields : [{ key: '', value: '' }],
      }));
    }
  }, [editFields, showEditDialog]);

  const filteredSecrets = secrets.filter(
    (secret) =>
      secret.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      secret.service.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const headerActions = (
    <div className="flex items-center space-x-3">
      <Button onClick={() => setShowNewSecretDialog(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Secret
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
        title="Secret Manager"
        subtitle="Securely manage API keys, service accounts, and third-party credentials"
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
                  <h3 className="font-semibold text-foreground mb-2">Enterprise-Grade Security</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-foreground">
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search secrets..."
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
                <p className="text-muted-foreground">Loading secrets...</p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && filteredSecrets.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <IconWrapper variant="default" size="xl" className="mx-auto mb-4">
                  <Key className="h-12 w-12" />
                </IconWrapper>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {searchQuery ? 'No secrets found' : 'No secrets yet'}
                </h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search or add a new secret'
                    : 'Add your first secret to securely store credentials for any third-party service. Define custom fields for maximum flexibility.'}
                </p>
                <Button size="lg" onClick={() => setShowNewSecretDialog(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Secret
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Secrets Grid */}
          {!isLoading && filteredSecrets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSecrets.map((secret) => (
                <Card
                  key={secret.id}
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
                              <h4 className="font-semibold text-foreground truncate">
                                {secret.name}
                              </h4>
                              <Badge variant="secondary" className="flex-shrink-0">
                                {secret.service}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                            <DropdownMenuItem onClick={() => handleEditClick(secret)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteClick(secret)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Error Message */}
                      {secret.lastError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-600">{secret.lastError}</p>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Used</p>
                          <p className="text-sm font-semibold text-foreground">
                            {secret.usageCount}x
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Created</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatDistanceToNow(new Date(secret.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Last Used</p>
                          <p className="text-sm font-semibold text-foreground">
                            {secret.lastUsed
                              ? formatDistanceToNow(new Date(secret.lastUsed), {
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

      {/* Add Secret Dialog */}
      <Dialog open={showNewSecretDialog} onOpenChange={setShowNewSecretDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Add New Secret</DialogTitle>
            <DialogDescription>
              Securely store credentials for any third-party service. All fields are encrypted with
              AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Secret Name */}
            <div className="space-y-2">
              <FloatingInput
                label="Secret Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                leftIcon={<Key className="h-4 w-4" />}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this secret (e.g., "Production Supabase", "Stripe Live")
              </p>
            </div>

            {/* Service Type Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Service Type</label>
              <Select
                value={formData.service}
                onValueChange={(value) => setFormData({ ...formData, service: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select service type..." />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the category that best describes this secret
              </p>
            </div>

            {/* Credential Fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">Credential Fields</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define custom fields for API keys, tokens, URLs, and other credentials
                  </p>
                </div>
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
                  <h4 className="font-medium text-foreground mb-1">Automatic Encryption</h4>
                  <p className="text-sm text-foreground">
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
                setShowNewSecretDialog(false);
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
                  Add Secret
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Secret Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Secret</DialogTitle>
            <DialogDescription>
              Update secret name or credentials. Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <FloatingInput
              label="Secret Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              leftIcon={<Key className="h-4 w-4" />}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
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
              <p className="text-xs text-muted-foreground">
                Leave fields empty to keep existing credentials
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedSecret(null);
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
                  Update Secret
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
            <DialogTitle>Delete Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSecret?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedSecret(null);
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
