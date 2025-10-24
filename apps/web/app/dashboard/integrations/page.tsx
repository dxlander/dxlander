"use client"

import { useState } from "react"
import Link from "next/link"
import { PageLayout, Header, Section } from "@/components/layouts"
import { IconWrapper } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input, FloatingInput } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Eye,
  EyeOff,
  CheckCircle2,
  FileJson,
  Lock,
  Upload,
  ShieldCheck,
  RefreshCw
} from "lucide-react"

type CredentialType = 'api_key' | 'json_service_account' | 'oauth_token' | 'connection_string' | 'key_value'

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewIntegrationDialog, setShowNewIntegrationDialog] = useState(false)
  const [credentialType, setCredentialType] = useState<CredentialType>('api_key')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Mock integrations data
  const integrations = [
    {
      id: '1',
      name: 'Production Supabase',
      type: 'database',
      service: 'Supabase',
      credentialType: 'connection_string' as CredentialType,
      status: 'connected',
      createdAt: '2 days ago',
      lastUsed: '1 hour ago',
      usageCount: 12,
      encryption: 'AES-256-GCM'
    },
    {
      id: '2',
      name: 'Stripe Payment Gateway',
      type: 'payment',
      service: 'Stripe',
      credentialType: 'api_key' as CredentialType,
      status: 'connected',
      createdAt: '5 days ago',
      lastUsed: '3 hours ago',
      usageCount: 8,
      encryption: 'AES-256-GCM'
    },
    {
      id: '3',
      name: 'AWS S3 Storage',
      type: 'storage',
      service: 'AWS S3',
      credentialType: 'key_value' as CredentialType,
      status: 'connected',
      createdAt: '1 week ago',
      lastUsed: '2 days ago',
      usageCount: 5,
      encryption: 'AES-256-GCM'
    },
    {
      id: '4',
      name: 'Firebase Service Account',
      type: 'database',
      service: 'Firebase',
      credentialType: 'json_service_account' as CredentialType,
      status: 'connected',
      createdAt: '3 days ago',
      lastUsed: '6 hours ago',
      usageCount: 15,
      encryption: 'AES-256-GCM'
    },
    {
      id: '5',
      name: 'SendGrid Email',
      type: 'email',
      service: 'SendGrid',
      credentialType: 'api_key' as CredentialType,
      status: 'error',
      createdAt: '3 days ago',
      lastUsed: 'Never',
      usageCount: 0,
      error: 'Invalid API key - please update credentials',
      encryption: 'AES-256-GCM'
    }
  ]

  const categories = [
    { id: 'all', label: 'All Integrations', count: integrations.length },
    { id: 'database', label: 'Databases', count: integrations.filter(i => i.type === 'database').length },
    { id: 'storage', label: 'Storage', count: integrations.filter(i => i.type === 'storage').length },
    { id: 'payment', label: 'Payment', count: integrations.filter(i => i.type === 'payment').length },
    { id: 'email', label: 'Email', count: integrations.filter(i => i.type === 'email').length },
  ]

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.service.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || integration.type === selectedCategory

    return matchesSearch && matchesCategory
  })

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="h-5 w-5" />
      case 'payment':
        return <CreditCard className="h-5 w-5" />
      case 'storage':
        return <Cloud className="h-5 w-5" />
      case 'email':
        return <Mail className="h-5 w-5" />
      default:
        return <Key className="h-5 w-5" />
    }
  }

  const getCredentialTypeIcon = (type: CredentialType) => {
    switch (type) {
      case 'json_service_account':
        return <FileJson className="h-4 w-4" />
      case 'oauth_token':
        return <ShieldCheck className="h-4 w-4" />
      default:
        return <Key className="h-4 w-4" />
    }
  }

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
  )

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
                {categories.map(cat => (
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

          {/* Integrations Grid */}
          {filteredIntegrations.length === 0 ? (
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
                    : 'Add your first integration to enable automatic credential management. AI will use these when analyzing and deploying projects.'
                  }
                </p>
                <Button size="lg" onClick={() => setShowNewIntegrationDialog(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Add First Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredIntegrations.map((integration) => (
                <Card key={integration.id} className="hover:shadow-elegant transition-all hover:border-ocean-300">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <IconWrapper variant="default" size="md" className="flex-shrink-0">
                            {getIntegrationIcon(integration.type)}
                          </IconWrapper>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">{integration.name}</h4>
                              {integration.status === 'connected' ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 flex-shrink-0">
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex-shrink-0">
                                  Error
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{integration.service}</p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Credentials
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
                      {integration.error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">{integration.error}</p>
                        </div>
                      )}

                      {/* Credential Type & Security */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          {getCredentialTypeIcon(integration.credentialType)}
                          <span className="capitalize">{integration.credentialType.replace('_', ' ')}</span>
                        </div>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Lock className="h-3.5 w-3.5" />
                          <span>{integration.encryption}</span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Used</p>
                          <p className="text-sm font-semibold text-gray-900">{integration.usageCount}x</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Created</p>
                          <p className="text-sm font-semibold text-gray-900">{integration.createdAt}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Last Used</p>
                          <p className="text-sm font-semibold text-gray-900">{integration.lastUsed}</p>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Add New Integration</DialogTitle>
            <DialogDescription>
              Add credentials for third-party services. All data is encrypted with AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <FloatingInput
                  label="Integration Name"
                  leftIcon={<Key className="h-4 w-4" />}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-type">Service Type</Label>
                <Select>
                  <SelectTrigger id="service-type">
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase</SelectItem>
                    <SelectItem value="firebase">Firebase</SelectItem>
                    <SelectItem value="mongodb">MongoDB Atlas</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="aws-s3">AWS S3</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="custom">Custom Integration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Credential Type */}
            <div className="space-y-2">
              <Label>Credential Type</Label>
              <Select value={credentialType} onValueChange={(v) => setCredentialType(v as CredentialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      <span>API Key</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="json_service_account">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      <span>JSON Service Account</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="oauth_token">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>OAuth Token</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="connection_string">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span>Connection String / URL</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="key_value">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      <span>Key-Value Pairs</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credential Input based on type */}
            <div className="space-y-2">
              {credentialType === 'api_key' && (
                <FloatingInput
                  label="API Key"
                  type="password"
                  leftIcon={<Key className="h-4 w-4" />}
                />
              )}

              {credentialType === 'json_service_account' && (
                <>
                  <Label htmlFor="json-file">Service Account JSON</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-ocean-400 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium text-ocean-600">Click to upload</span> or paste JSON
                    </p>
                    <p className="text-xs text-gray-500">Firebase, GCP service accounts</p>
                  </div>
                </>
              )}

              {credentialType === 'connection_string' && (
                <FloatingInput
                  label="Connection String"
                  type="password"
                  leftIcon={<Database className="h-4 w-4" />}
                />
              )}

              {credentialType === 'key_value' && (
                <>
                  <Label>Key-Value Pairs</Label>
                  <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-3">
                      <FloatingInput label="Key Name" leftIcon={<Key className="h-4 w-4" />} />
                      <FloatingInput label="Key Value" type="password" leftIcon={<Lock className="h-4 w-4" />} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FloatingInput label="Key Name" leftIcon={<Key className="h-4 w-4" />} />
                      <FloatingInput label="Key Value" type="password" leftIcon={<Lock className="h-4 w-4" />} />
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add More Fields
                    </Button>
                  </div>
                </>
              )}

              {credentialType === 'oauth_token' && (
                <>
                  <FloatingInput
                    label="OAuth Access Token"
                    type="password"
                    leftIcon={<ShieldCheck className="h-4 w-4" />}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <FloatingInput
                      label="Refresh Token (Optional)"
                      type="password"
                      leftIcon={<RefreshCw className="h-4 w-4" />}
                    />
                    <FloatingInput
                      label="Client ID (Optional)"
                      leftIcon={<Key className="h-4 w-4" />}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Encryption Info */}
            <div className="p-4 bg-ocean-50 border border-ocean-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-ocean-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Automatic Encryption</h4>
                  <p className="text-sm text-gray-700">
                    This credential will be encrypted using your master encryption key (AES-256-GCM). You can manage your encryption key in Settings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewIntegrationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowNewIntegrationDialog(false)}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
