'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FloatingInput } from '@/components/ui/input';
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
  ExternalLink,
  Database,
  Shield,
  Zap,
  Key,
  CheckCircle2,
  Copy,
  Link2,
  Link2Off,
  Settings2,
  Plus,
  Loader2,
  AlertCircle,
  Mail,
  CreditCard,
  Cloud,
  Server,
  Globe,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface DetectedIntegration {
  name: string;
  type: string;
  detectedFrom: string;
  optional?: boolean;
  requiredKeys: string[];
  notes?: string;
}

interface IntegrationsSummary {
  integrations?: {
    detected?: DetectedIntegration[];
  };
}

interface IntegrationsTabProps {
  summary: IntegrationsSummary | null;
  integrationsCount: number;
  configSetId: string;
}

const getServiceIcon = (service: string) => {
  switch (service?.toUpperCase()) {
    case 'DATABASE':
      return <Database className="h-4 w-4" />;
    case 'EMAIL':
      return <Mail className="h-4 w-4" />;
    case 'PAYMENT':
      return <CreditCard className="h-4 w-4" />;
    case 'CLOUD':
      return <Cloud className="h-4 w-4" />;
    case 'BACKEND':
      return <Server className="h-4 w-4" />;
    case 'API':
      return <Globe className="h-4 w-4" />;
    default:
      return <Key className="h-4 w-4" />;
  }
};

const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'payment':
      return <Shield className="h-4 w-4" />;
    case 'ai':
      return <Zap className="h-4 w-4" />;
    case 'auth':
      return <Key className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
};

export function IntegrationsTab({ summary, integrationsCount, configSetId }: IntegrationsTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [selectedLinkedIntegration, setSelectedLinkedIntegration] = useState<{
    id: string;
    name: string;
    overrides: Record<string, string>;
    keys: string[];
  } | null>(null);
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  // Fetch linked integrations
  const {
    data: linkedIntegrations = [],
    isLoading: linkedLoading,
    refetch: refetchLinked,
  } = trpc.configIntegrations.list.useQuery({ configSetId }, { enabled: !!configSetId });

  // Fetch available integrations (not yet linked)
  const { data: availableIntegrations = [], isLoading: availableLoading } =
    trpc.configIntegrations.available.useQuery({ configSetId }, { enabled: !!configSetId });

  // Mutations
  const linkMutation = trpc.configIntegrations.link.useMutation({
    onSuccess: () => {
      toast.success('Integration linked successfully');
      refetchLinked();
      setShowLinkDialog(false);
      setSelectedIntegrationId('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unlinkMutation = trpc.configIntegrations.unlink.useMutation({
    onSuccess: () => {
      toast.success('Integration unlinked successfully');
      refetchLinked();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateOverridesMutation = trpc.configIntegrations.updateOverrides.useMutation({
    onSuccess: () => {
      toast.success('Overrides updated successfully');
      refetchLinked();
      setShowOverrideDialog(false);
      setSelectedLinkedIntegration(null);
      setOverrideValues({});
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleLinkIntegration = () => {
    if (!selectedIntegrationId) return;
    linkMutation.mutate({
      configSetId,
      integrationId: selectedIntegrationId,
    });
  };

  const handleUnlinkIntegration = (integrationId: string) => {
    unlinkMutation.mutate({
      configSetId,
      integrationId,
    });
  };

  const handleOpenOverrides = (linked: {
    id: string;
    name: string;
    overrides: Record<string, string>;
    keys: string[];
  }) => {
    setSelectedLinkedIntegration(linked);
    setOverrideValues(linked.overrides || {});
    setShowOverrideDialog(true);
  };

  const handleSaveOverrides = () => {
    if (!selectedLinkedIntegration) return;
    updateOverridesMutation.mutate({
      configSetId,
      integrationId: selectedLinkedIntegration.id,
      overrides: overrideValues,
    });
  };

  return (
    <div className="space-y-6">
      {/* Linked Integrations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-ocean-600" />
              <h3 className="text-lg font-semibold">Linked Integrations</h3>
            </div>
            <Button
              size="sm"
              onClick={() => setShowLinkDialog(true)}
              disabled={availableIntegrations.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Link Integration
            </Button>
          </div>
          <CardDescription>
            Integrations from Settings linked to this configuration for deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
            </div>
          ) : linkedIntegrations.length > 0 ? (
            <div className="space-y-3">
              {linkedIntegrations.map((item) => {
                const { link, integration } = item;
                const overrides = link.overrides || {};
                const overrideCount = Object.keys(overrides).length;

                return (
                  <div
                    key={link.id}
                    className="border rounded-lg p-4 hover:border-ocean-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-ocean-50 text-ocean-600">
                          {getServiceIcon(integration.service)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{integration.name}</h4>
                          <p className="text-sm text-gray-500">{integration.service}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {overrideCount > 0 && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Linked
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleOpenOverrides({
                              id: link.integrationId,
                              name: integration.name,
                              overrides,
                              keys: Object.keys(overrides),
                            })
                          }
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkIntegration(link.integrationId)}
                          disabled={unlinkMutation.isPending}
                        >
                          <Link2Off className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {overrideCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">Override Variables:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(overrides).map((key) => (
                            <code
                              key={key}
                              className="text-xs font-mono bg-gray-100 px-2 py-1 rounded"
                            >
                              {key}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No integrations linked yet</p>
              <p className="text-xs mt-1">
                Link integrations from Settings to use their credentials during deployment
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detected Integrations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-ocean-600" />
              <h3 className="text-lg font-semibold">Detected Integrations</h3>
            </div>
            <Badge variant="outline">{integrationsCount} detected</Badge>
          </div>
          <CardDescription>External services detected from project analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {summary?.integrations?.detected && summary.integrations.detected.length > 0 ? (
            <div className="space-y-4">
              {summary.integrations.detected.map((integration, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg p-6 hover:border-ocean-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-ocean-50 text-ocean-600">
                        {getIntegrationIcon(integration.type)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{integration.name}</h4>
                        <p className="text-sm text-gray-600 mt-0.5">
                          <span className="font-medium">Type:</span> {integration.type}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">{integration.detectedFrom}</p>
                      </div>
                    </div>
                    <Badge variant={integration.optional ? 'secondary' : 'default'}>
                      {integration.optional ? 'Optional' : 'Required'}
                    </Badge>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-900">
                      Required Environment Variables:
                    </p>
                    <div className="grid gap-2">
                      {integration.requiredKeys.map((key, keyIdx) => (
                        <div
                          key={keyIdx}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded border group hover:border-ocean-300 transition-colors"
                        >
                          <code className="text-sm font-mono flex-1 text-gray-900">{key}</code>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyKey(key)}>
                            {copiedKey === key ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {integration.notes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-900">{integration.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="text-center py-16">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No External Integrations Detected
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  This project is self-contained and doesn&apos;t require external services.
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  <strong>Note:</strong> Integrations are external services requiring API keys,
                  tokens, or credentials (e.g., Supabase, Stripe, SendGrid). Built-in features like
                  localStorage are not integrations.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Link Integration Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Integration</DialogTitle>
            <DialogDescription>
              Select an integration from Settings to link to this configuration. Its credentials
              will be used during deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
              </div>
            ) : availableIntegrations.length > 0 ? (
              <Select value={selectedIntegrationId} onValueChange={setSelectedIntegrationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an integration" />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      <div className="flex items-center gap-2">
                        {getServiceIcon(integration.service)}
                        <span>{integration.name}</span>
                        <span className="text-gray-500">({integration.service})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No integrations available to link</p>
                <p className="text-xs mt-1">Create integrations in Settings first</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLinkIntegration}
              disabled={!selectedIntegrationId || linkMutation.isPending}
            >
              {linkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Link Integration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Values Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Override Values</DialogTitle>
            <DialogDescription>
              Set custom values for {selectedLinkedIntegration?.name} that override the saved
              credentials for this configuration only.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {selectedLinkedIntegration?.keys.map((key) => (
              <div key={key}>
                <FloatingInput
                  id={`override-${key}`}
                  label={key}
                  value={overrideValues[key] || ''}
                  onChange={(e) =>
                    setOverrideValues((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use the saved value from Settings
                </p>
              </div>
            ))}
            {(!selectedLinkedIntegration?.keys || selectedLinkedIntegration.keys.length === 0) && (
              <p className="text-center text-gray-500 py-4">
                No keys available for this integration
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOverrides} disabled={updateOverridesMutation.isPending}>
              {updateOverridesMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Overrides'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
