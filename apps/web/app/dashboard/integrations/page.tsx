'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { IconWrapper } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, FloatingInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Database,
  Cloud,
  Mail,
  CreditCard,
  Key,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle2,
  FileJson,
  Lock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  TestTube,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type CredentialType =
  | 'api_key'
  | 'json_service_account'
  | 'oauth_token'
  | 'connection_string'
  | 'key_value';

interface IntegrationFormData {
  name: string;
  service: string;
  serviceType: string;
  credentialType: CredentialType;
  credentials: Record<string, string>;
}

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewIntegrationDialog, setShowNewIntegrationDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<IntegrationFormData>({
    name: '',
    service: '',
    serviceType: 'database',
    credentialType: 'api_key',
    credentials: {},
  });

  // tRPC queries and mutations
  const { data: integrations = [], isLoading, refetch } = trpc.integrations.list.useQuery();
  const { data: availableIntegrations = [] } = trpc.integrations.listAvailable.useQuery();

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

  const testMutation = trpc.integrations.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      refetch();
      setIsTesting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsTesting(false);
    },
  });

  const testConnectionMutation = trpc.integrations.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      setIsTesting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsTesting(false);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      service: '',
      serviceType: 'database',
      credentialType: 'api_key',
      credentials: {},
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.service || Object.keys(formData.credentials).length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    createMutation.mutate({
      name: formData.name,
      service: formData.service,
      serviceType: formData.serviceType,
      credentialType: formData.credentialType,
      credentials: formData.credentials,
    });
  };

  const handleUpdate = () => {
    if (!selectedIntegration) return;

    updateMutation.mutate({
      id: selectedIntegration.id,
      name: formData.name || undefined,
      credentials: Object.keys(formData.credentials).length > 0 ? formData.credentials : undefined,
    });
  };

  const handleDelete = () => {
    if (!selectedIntegration) return;
    deleteMutation.mutate({ id: selectedIntegration.id });
  };

  const handleTest = (integration: any) => {
    setIsTesting(true);
    testMutation.mutate({ id: integration.id });
  };

  const handleTestConnection = () => {
    if (!formData.service || Object.keys(formData.credentials).length === 0) {
      toast.error('Please select a service and enter credentials');
      return;
    }

    setIsTesting(true);
    testConnectionMutation.mutate({
      service: formData.service,
      credentials: formData.credentials,
    });
  };

  const handleServiceChange = (serviceId: string) => {
    const service = availableIntegrations.find((s: any) => s.service === serviceId);
    if (service) {
      setFormData({
        ...formData,
        service: serviceId,
        serviceType: service.type,
        credentialType: service.credentialType as CredentialType,
        credentials: {},
      });
    }
  };

  const handleEditClick = (integration: any) => {
    setSelectedIntegration(integration);
    setFormData({
      name: integration.name,
      service: integration.service,
      serviceType: integration.serviceType,
      credentialType: integration.credentialType,
      credentials: {},
    });
    setShowEditDialog(true);
  };

  const handleDeleteClick = (integration: any) => {
    setSelectedIntegration(integration);
    setShowDeleteDialog(true);
  };

  const updateCredentialField = (key: string, value: string) => {
    setFormData({
      ...formData,
      credentials: { ...formData.credentials, [key]: value },
    });
  };

  // Calculate categories with counts
  const categories = [
    { id: 'all', label: 'All Integrations', count: integrations.length },
    { id: 'database', label: 'Databases', count: integrations.filter((i) => i.serviceType === 'database').length },
    { id: 'storage', label: 'Storage', count: integrations.filter((i) => i.serviceType === 'storage').length },
    { id: 'payment', label: 'Payment', count: integrations.filter((i) => i.serviceType === 'payment').length },
    { id: 'email', label: 'Email', count: integrations.filter((i) => i.serviceType === 'email').length },
    { id: 'auth', label: 'Auth', count: integrations.filter((i) => i.serviceType === 'auth').length },
  ];

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.service.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.serviceType === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="h-5 w-5" />;
      case 'payment':
        return <CreditCard className="h-5 w-5" />;
      case 'storage':
        return <Cloud className="h-5 w-5" />;
      case 'email':
        return <Mail className="h-5 w-5" />;
      default:
        return <Key className="h-5 w-5" />;
    }
  };

  const getCredentialTypeIcon = (type: CredentialType) => {
    switch (type) {
      case 'json_service_account':
        return <FileJson className="h-4 w-4" />;
      case 'oauth_token':
        return <ShieldCheck className="h-4 w-4" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  const renderCredentialInputs = () => {
    const selectedService = availableIntegrations.find((s: any) => s.service === formData.service);
    if (!selectedService) return null;

    const allFields = [...selectedService.requiredCredentials, ...selectedService.optionalCredentials];

    return (
      <div className="space-y-3">
        {allFields.map((field: string) => (
          <FloatingInput
            key={field}
            label={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
            type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') || field.toLowerCase().includes('password') ? 'password' : 'text'}
            value={formData.credentials[field] || ''}
            onChange={(e) => updateCredentialField(field, e.target.value)}
            leftIcon={<Key className="h-4 w-4" />}
          />
        ))}
      </div>
    );
  };

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
                      <span>Auto-injection by AI</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search & Filter */}
          <div className="flex items-center justify-between gap-4">
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                {categories.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="relative">
                    {cat.label}
                    {cat.count > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-gray-200 text-gray-700">
                        {cat.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
                    : 'Add your first integration to enable automatic credential management. AI will use these when analyzing and deploying projects.'}
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
                            {getIntegrationIcon(integration.serviceType)}
                          </IconWrapper>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {integration.name}
                              </h4>
                              {integration.status === 'connected' ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-green-100 text-green-700 flex-shrink-0"
                                >
                                  Connected
                                </Badge>
                              ) : integration.status === 'error' ? (
                                <Badge variant="destructive" className="flex-shrink-0">
                                  Error
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="flex-shrink-0">
                                  Unknown
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 capitalize">{integration.service}</p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleTest(integration)}>
                              <TestTube className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
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

                      {/* Credential Type & Security */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          {getCredentialTypeIcon(integration.credentialType)}
                          <span className="capitalize">
                            {integration.credentialType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Lock className="h-3.5 w-3.5" />
                          <span>AES-256-GCM</span>
                        </div>
                      </div>

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
                            {formatDistanceToNow(new Date(integration.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Used</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {integration.lastUsed
                              ? formatDistanceToNow(new Date(integration.lastUsed), { addSuffix: true })
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
              Add credentials for third-party services. All data is encrypted with AES-256-GCM.
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

            <div className="space-y-2">
              <Label htmlFor="service-type">Service</Label>
              <Select value={formData.service} onValueChange={handleServiceChange}>
                <SelectTrigger id="service-type">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((service: any) => (
                    <SelectItem key={service.service} value={service.service}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.service && (
              <>
                <div className="space-y-2">
                  <Label>Credentials</Label>
                  {renderCredentialInputs()}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting || Object.keys(formData.credentials).length === 0}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            <div className="p-4 bg-ocean-50 border border-ocean-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-ocean-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Automatic Encryption</h4>
                  <p className="text-sm text-gray-700">
                    Credentials will be encrypted using AES-256-GCM before storage.
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
              Update integration name or credentials. Leave credentials empty to keep existing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <FloatingInput
              label="Integration Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              leftIcon={<Key className="h-4 w-4" />}
            />

            <div className="space-y-2">
              <Label>Update Credentials (optional)</Label>
              {renderCredentialInputs()}
              <p className="text-xs text-gray-500">Leave empty to keep existing credentials</p>
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
              Are you sure you want to delete "{selectedIntegration?.name}"? This action cannot be undone.
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
