"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageLayout, Header, Section } from "@/components/layouts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input, FloatingInput } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Database,
  Key,
  Zap,
  Shield,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Server,
  Boxes,
  Globe
} from "lucide-react"
import { AIProvidersTab } from "@/components/settings/ai-providers-tab"

function SettingsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const [activeTab, setActiveTab] = useState(tabParam === 'ai-providers' ? 'ai' : 'ai')
  const [defaultPlatform, setDefaultPlatform] = useState("vercel")
  const [showEncryptionKey, setShowEncryptionKey] = useState(false)
  const [showRotateKeyDialog, setShowRotateKeyDialog] = useState(false)
  const [databaseType, setDatabaseType] = useState("sqlite")
  const [hasCustomKey, setHasCustomKey] = useState(true)

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam === 'ai-providers') {
      setActiveTab('ai')
    }
  }, [tabParam])

  const headerActions = (
    <Link href="/dashboard">
      <Button variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
    </Link>
  )

  return (
    <PageLayout background="default">
      <Header
        title="Settings"
        subtitle="Configure AI providers, encryption, database, and deployment defaults"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="ai">
                <Zap className="h-4 w-4 mr-2" />
                AI Provider
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="database">
                <Database className="h-4 w-4 mr-2" />
                Database
              </TabsTrigger>
              <TabsTrigger value="deployment">
                <Server className="h-4 w-4 mr-2" />
                Deployment
              </TabsTrigger>
            </TabsList>

            {/* AI Provider Settings */}
            <TabsContent value="ai" className="space-y-6">
              <AIProvidersTab />
            </TabsContent>

            {/* Security & Encryption Settings */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Master Encryption Key</CardTitle>
                  <CardDescription>
                    This key encrypts ALL credentials, API keys, and sensitive data stored in DXLander
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-gradient-to-r from-ocean-50 to-blue-50 border border-ocean-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-ocean-100 rounded-lg">
                        <Shield className="h-5 w-5 text-ocean-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">AES-256-GCM Encryption</h4>
                        <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>All credentials encrypted at rest</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Zero-knowledge architecture</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Secure key rotation supported</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>Industry-standard encryption</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="encryption-key">Current Encryption Key</Label>
                        {hasCustomKey ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            Custom Key Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                            System Generated
                          </Badge>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Input
                          id="encryption-key"
                          type={showEncryptionKey ? "text" : "password"}
                          value="pk_live_51MZxKLB2qVn8zQ9X7hYjKmN3pWrStUvXyZ4aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                        >
                          {showEncryptionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Keep this key safe. You'll need it to decrypt your data if you migrate to another instance.
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">Key Created</p>
                          <p className="text-sm text-gray-600">During initial setup - 5 days ago</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => setShowRotateKeyDialog(true)}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rotate Key
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">What's Encrypted</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        'Integration API Keys',
                        'Service Account JSONs',
                        'Database Credentials',
                        'OAuth Tokens',
                        'AI Provider Keys',
                        'Deployment Keys',
                        'SSH Keys',
                        'Environment Variables'
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Database Settings */}
            <TabsContent value="database" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Configuration</CardTitle>
                  <CardDescription>
                    Configure your database connection and storage settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="database-type">Database Type</Label>
                      <Select value={databaseType} onValueChange={setDatabaseType}>
                        <SelectTrigger id="database-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sqlite">
                            <div className="flex items-center justify-between w-full">
                              <span>SQLite (Default)</span>
                              <Badge variant="secondary" className="ml-2">Recommended</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="postgresql">PostgreSQL</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {databaseType === 'sqlite' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="db-path">Database Path</Label>
                          <Input
                            id="db-path"
                            value="~/.dxlander/data/dxlander.db"
                            readOnly
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-gray-500">
                            SQLite database is stored locally. Perfect for single-user installations.
                          </p>
                        </div>

                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">SQLite Benefits</h4>
                              <ul className="text-sm text-gray-700 space-y-1">
                                <li>• Zero configuration required</li>
                                <li>• Fast and lightweight</li>
                                <li>• Perfect for self-hosted setups</li>
                                <li>• Easy to backup (single file)</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {databaseType === 'postgresql' && (
                      <>
                        <div className="space-y-2">
                          <FloatingInput
                            label="Connection String"
                            type="password"
                            leftIcon={<Database className="h-4 w-4" />}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <FloatingInput
                              label="Connection Pool Size"
                              type="number"
                              defaultValue="10"
                            />
                          </div>
                          <div className="space-y-2">
                            <FloatingInput
                              label="Connection Timeout (s)"
                              type="number"
                              defaultValue="30"
                            />
                          </div>
                        </div>

                        <Button variant="outline" className="w-full">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Test Connection
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Database Storage</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Projects</p>
                        <p className="text-2xl font-bold text-gray-900">12</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Integrations</p>
                        <p className="text-2xl font-bold text-gray-900">5</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Database Size</p>
                        <p className="text-2xl font-bold text-gray-900">2.4 MB</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backup & Restore</CardTitle>
                  <CardDescription>
                    Manage database backups and restore points
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Automatic Backups</p>
                      <p className="text-sm text-gray-600">Daily at 2:00 AM</p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Enabled
                    </Badge>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1">
                      <Database className="h-4 w-4 mr-2" />
                      Create Backup Now
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Restore from Backup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deployment Defaults */}
            <TabsContent value="deployment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default Deployment Settings</CardTitle>
                  <CardDescription>
                    Set default deployment targets and automation preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-platform">Default Deployment Platform</Label>
                      <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                        <SelectTrigger id="default-platform">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vercel">Vercel</SelectItem>
                          <SelectItem value="railway">Railway</SelectItem>
                          <SelectItem value="netlify">Netlify</SelectItem>
                          <SelectItem value="docker">Docker Compose (Local)</SelectItem>
                          <SelectItem value="manual">Manual Configuration Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="docker-registry">Docker Registry</Label>
                      <Select defaultValue="dockerhub">
                        <SelectTrigger id="docker-registry">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dockerhub">Docker Hub</SelectItem>
                          <SelectItem value="ghcr">GitHub Container Registry</SelectItem>
                          <SelectItem value="gcr">Google Container Registry</SelectItem>
                          <SelectItem value="ecr">AWS ECR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="region">Default Region</Label>
                      <Select defaultValue="us-east-1">
                        <SelectTrigger id="region">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                          <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                          <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                          <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Automation Preferences</h4>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <Boxes className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">Auto-generate Dockerfile</p>
                          <p className="text-sm text-gray-600">Automatically create Dockerfile after analysis</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Enabled
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">Auto-inject integrations</p>
                          <p className="text-sm text-gray-600">Automatically use saved integrations in deployments</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Enabled
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 text-gray-600" />
                        <div>
                          <p className="font-medium text-gray-900">Auto-deploy on analysis complete</p>
                          <p className="text-sm text-gray-600">Deploy immediately after successful analysis</p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        Disabled
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <Link href="/dashboard">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button size="lg">
              <Save className="h-4 w-4 mr-2" />
              Save All Settings
            </Button>
          </div>
        </div>
      </Section>

      {/* Rotate Key Dialog */}
      <Dialog open={showRotateKeyDialog} onOpenChange={setShowRotateKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Encryption Key</DialogTitle>
            <DialogDescription>
              Generate a new master encryption key and re-encrypt all stored credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Important Warning</h4>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• All credentials will be re-encrypted with the new key</li>
                    <li>• The old key will no longer work</li>
                    <li>• This operation cannot be undone</li>
                    <li>• Save the new key in a secure location</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Encryption Key</Label>
              <Select defaultValue="generate">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generate">Generate Secure Key (Recommended)</SelectItem>
                  <SelectItem value="custom">Provide Custom Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotateKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowRotateKeyDialog(false)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rotate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      </PageLayout>
    }>
      <SettingsContent />
    </Suspense>
  )
}
