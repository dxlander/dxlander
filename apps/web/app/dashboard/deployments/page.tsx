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
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Cloud,
  Server,
  Container,
  Zap,
  AlertCircle,
  Star,
  Play,
} from 'lucide-react';

type PlatformCategory = 'all' | 'paas' | 'cloud' | 'container';

export default function DeploymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewTargetDialog, setShowNewTargetDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlatformCategory>('all');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [showConfigFields, setShowConfigFields] = useState(false);

  // Mock deployment targets data
  const deploymentTargets = [
    {
      id: '1',
      name: 'Production Vercel',
      platform: 'vercel',
      category: 'paas' as PlatformCategory,
      status: 'connected',
      isDefault: true,
      createdAt: '2 days ago',
      lastUsed: '1 hour ago',
      usageCount: 12,
      encryption: 'AES-256-GCM',
      lastTestStatus: 'success',
      settings: { teamId: 'team_abc123' },
    },
    {
      id: '2',
      name: 'Railway Staging',
      platform: 'railway',
      category: 'paas' as PlatformCategory,
      status: 'connected',
      isDefault: false,
      createdAt: '5 days ago',
      lastUsed: '3 hours ago',
      usageCount: 8,
      encryption: 'AES-256-GCM',
      lastTestStatus: 'success',
      settings: { projectId: 'proj_xyz789' },
    },
    {
      id: '3',
      name: 'AWS Production',
      platform: 'aws',
      category: 'cloud' as PlatformCategory,
      status: 'connected',
      isDefault: false,
      createdAt: '1 week ago',
      lastUsed: '2 days ago',
      usageCount: 5,
      encryption: 'AES-256-GCM',
      lastTestStatus: 'success',
      settings: { region: 'us-east-1' },
    },
    {
      id: '4',
      name: 'Docker Hub Registry',
      platform: 'docker-registry',
      category: 'container' as PlatformCategory,
      status: 'connected',
      isDefault: false,
      createdAt: '3 days ago',
      lastUsed: '6 hours ago',
      usageCount: 15,
      encryption: 'AES-256-GCM',
      lastTestStatus: 'success',
      settings: { registry: 'docker.io', username: 'myusername' },
    },
    {
      id: '5',
      name: 'Netlify Production',
      platform: 'netlify',
      category: 'paas' as PlatformCategory,
      status: 'error',
      isDefault: false,
      createdAt: '3 days ago',
      lastUsed: 'Never',
      usageCount: 0,
      error: 'Invalid API token - please update credentials',
      encryption: 'AES-256-GCM',
      lastTestStatus: 'failed',
    },
  ];

  // Available platforms
  const platforms = [
    { id: 'vercel', name: 'Vercel', icon: Zap, category: 'paas', color: 'black' },
    { id: 'railway', name: 'Railway', icon: Zap, category: 'paas', color: 'purple' },
    { id: 'netlify', name: 'Netlify', icon: Zap, category: 'paas', color: 'cyan' },
    { id: 'render', name: 'Render', icon: Zap, category: 'paas', color: 'green' },
    { id: 'fly-io', name: 'Fly.io', icon: Zap, category: 'paas', color: 'violet' },
    { id: 'aws', name: 'AWS', icon: Cloud, category: 'cloud', color: 'orange' },
    { id: 'gcp', name: 'Google Cloud', icon: Cloud, category: 'cloud', color: 'blue' },
    { id: 'azure', name: 'Azure', icon: Cloud, category: 'cloud', color: 'azure' },
    { id: 'digital-ocean', name: 'DigitalOcean', icon: Cloud, category: 'cloud', color: 'blue' },
    {
      id: 'docker-registry',
      name: 'Docker Registry',
      icon: Container,
      category: 'container',
      color: 'blue',
    },
    { id: 'kubernetes', name: 'Kubernetes', icon: Container, category: 'container', color: 'blue' },
    { id: 'heroku', name: 'Heroku', icon: Server, category: 'paas', color: 'purple' },
  ];

  const categories = [
    { id: 'all', label: 'All Platforms', count: deploymentTargets.length },
    {
      id: 'paas',
      label: 'Platform as a Service',
      count: deploymentTargets.filter((t) => t.category === 'paas').length,
    },
    {
      id: 'cloud',
      label: 'Cloud Providers',
      count: deploymentTargets.filter((t) => t.category === 'cloud').length,
    },
    {
      id: 'container',
      label: 'Container Registries',
      count: deploymentTargets.filter((t) => t.category === 'container').length,
    },
  ];

  const filteredTargets = deploymentTargets.filter((target) => {
    const matchesSearch =
      target.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      target.platform.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || target.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getPlatformIcon = (platformId: string) => {
    const platform = platforms.find((p) => p.id === platformId);
    const Icon = platform?.icon || Server;
    return <Icon className="h-5 w-5" />;
  };

  const getPlatformName = (platformId: string) => {
    return platforms.find((p) => p.id === platformId)?.name || platformId;
  };

  const headerActions = (
    <div className="flex items-center space-x-3">
      <Button onClick={() => setShowNewTargetDialog(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Deployment Target
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
        title="Deployment Targets"
        subtitle="Manage deployment platform credentials and configure where your projects deploy"
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
                  <h3 className="font-semibold text-gray-900 mb-2">Secure Credential Management</h3>
                  <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>AES-256-GCM Encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Connection Testing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Auto-deploy Integration</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search & Filter */}
          <div className="flex items-center justify-between gap-4">
            <Tabs
              value={selectedCategory}
              onValueChange={(v) => setSelectedCategory(v as PlatformCategory)}
            >
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
                placeholder="Search deployment targets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Deployment Targets Grid */}
          {filteredTargets.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-16 text-center">
                <IconWrapper variant="default" size="xl" className="mx-auto mb-4">
                  <Server className="h-12 w-12" />
                </IconWrapper>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchQuery ? 'No deployment targets found' : 'No deployment targets yet'}
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search or add a new deployment target'
                    : 'Add your first deployment target to enable automatic deployments. Connect Vercel, Railway, AWS, and more.'}
                </p>
                <Button size="lg" onClick={() => setShowNewTargetDialog(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Deployment Target
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredTargets.map((target) => (
                <Card
                  key={target.id}
                  className="hover:shadow-elegant transition-all hover:border-ocean-300"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <IconWrapper variant="default" size="md" className="flex-shrink-0">
                            {getPlatformIcon(target.platform)}
                          </IconWrapper>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {target.name}
                              </h4>
                              {target.isDefault && (
                                <Badge
                                  variant="secondary"
                                  className="bg-ocean-100 text-ocean-700 flex-shrink-0"
                                >
                                  <Star className="h-3 w-3 mr-1 fill-current" />
                                  Default
                                </Badge>
                              )}
                              {target.status === 'connected' ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-green-100 text-green-700 flex-shrink-0"
                                >
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex-shrink-0">
                                  Error
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {getPlatformName(target.platform)}
                            </p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Play className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
                            {!target.isDefault && (
                              <DropdownMenuItem>
                                <Star className="h-4 w-4 mr-2" />
                                Set as Default
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Error Message */}
                      {target.error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-700">{target.error}</p>
                        </div>
                      )}

                      {/* Settings */}
                      {target.settings && Object.keys(target.settings).length > 0 && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(target.settings).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-gray-500">{key}:</span>{' '}
                                <span className="font-medium text-gray-900">{value as string}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-6 pt-3 border-t border-gray-200 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Encryption</p>
                          <div className="flex items-center gap-1">
                            <Lock className="h-3 w-3 text-ocean-600" />
                            <span className="font-medium text-gray-900">{target.encryption}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Used</p>
                          <p className="font-semibold text-gray-900">{target.usageCount} times</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Created</p>
                          <p className="text-sm font-semibold text-gray-900">{target.createdAt}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Used</p>
                          <p className="text-sm font-semibold text-gray-900">{target.lastUsed}</p>
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

      {/* Add Deployment Target Dialog */}
      <Dialog open={showNewTargetDialog} onOpenChange={setShowNewTargetDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Deployment Target</DialogTitle>
            <DialogDescription>
              Configure a new deployment platform. All credentials are encrypted with AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <FloatingInput
                  label="Target Name (e.g., Production Vercel, AWS Staging)"
                  leftIcon={<Server className="h-4 w-4" />}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Deployment Platform</Label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(value) => {
                    setSelectedPlatform(value);
                    setShowConfigFields(true);
                  }}
                >
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Select deployment platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
                      Platform as a Service
                    </div>
                    {platforms
                      .filter((p) => p.category === 'paas')
                      .map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          <div className="flex items-center gap-2">
                            <platform.icon className="h-4 w-4" />
                            <span>{platform.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-t mt-1">
                      Cloud Providers
                    </div>
                    {platforms
                      .filter((p) => p.category === 'cloud')
                      .map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          <div className="flex items-center gap-2">
                            <platform.icon className="h-4 w-4" />
                            <span>{platform.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-t mt-1">
                      Container Registries
                    </div>
                    {platforms
                      .filter((p) => p.category === 'container')
                      .map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          <div className="flex items-center gap-2">
                            <platform.icon className="h-4 w-4" />
                            <span>{platform.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Platform-specific fields */}
            {showConfigFields && selectedPlatform && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900">Platform Configuration</h4>

                {/* Vercel */}
                {selectedPlatform === 'vercel' && (
                  <div className="space-y-3">
                    <FloatingInput
                      label="Vercel API Token"
                      type="password"
                      leftIcon={<Lock className="h-4 w-4" />}
                    />
                    <FloatingInput label="Team ID (Optional) - team_abc123" />
                  </div>
                )}

                {/* Railway */}
                {selectedPlatform === 'railway' && (
                  <div className="space-y-3">
                    <FloatingInput
                      label="Railway API Token"
                      type="password"
                      leftIcon={<Lock className="h-4 w-4" />}
                    />
                    <FloatingInput label="Project ID (Optional) - proj_xyz789" />
                  </div>
                )}

                {/* AWS */}
                {selectedPlatform === 'aws' && (
                  <div className="space-y-3">
                    <FloatingInput
                      label="Access Key ID - AKIA..."
                      leftIcon={<Lock className="h-4 w-4" />}
                    />
                    <FloatingInput
                      label="Secret Access Key"
                      type="password"
                      leftIcon={<Lock className="h-4 w-4" />}
                    />
                    <FloatingInput label="AWS Region - us-east-1" />
                  </div>
                )}

                {/* Docker Registry */}
                {selectedPlatform === 'docker-registry' && (
                  <div className="space-y-3">
                    <FloatingInput label="Registry URL - docker.io" />
                    <FloatingInput label="Username" />
                    <FloatingInput
                      label="Password/Token"
                      type="password"
                      leftIcon={<Lock className="h-4 w-4" />}
                    />
                  </div>
                )}

                {/* Generic API Key for other platforms */}
                {!['vercel', 'railway', 'aws', 'docker-registry'].includes(selectedPlatform) && (
                  <FloatingInput
                    label={`${getPlatformName(selectedPlatform)} API Token`}
                    type="password"
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                )}
              </div>
            )}

            {/* Encryption Info */}
            <div className="p-4 bg-ocean-50 border border-ocean-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-ocean-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Automatic Encryption</h4>
                  <p className="text-sm text-gray-700">
                    All credentials are encrypted using AES-256-GCM with your master encryption key.
                    They're securely stored and never exposed in plain text.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewTargetDialog(false);
                setSelectedPlatform('');
                setShowConfigFields(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement save
                setShowNewTargetDialog(false);
                setSelectedPlatform('');
                setShowConfigFields(false);
              }}
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Add Deployment Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
