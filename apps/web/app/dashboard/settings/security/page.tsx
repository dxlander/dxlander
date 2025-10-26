'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft,
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Download,
} from 'lucide-react';

function SecurityContent() {
  const [showEncryptionKey, setShowEncryptionKey] = useState(false);
  const [showRotateKeyDialog, setShowRotateKeyDialog] = useState(false);
  const [hasCustomKey] = useState(true);

  const headerActions = (
    <Link href="/dashboard/settings">
      <Button variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Settings
      </Button>
    </Link>
  );

  return (
    <PageLayout background="default">
      <Header
        title="Security & Encryption"
        subtitle="Manage master encryption key and security settings"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {/* Master Encryption Key */}
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
                      type={showEncryptionKey ? 'text' : 'password'}
                      value="pk_live_51MZxKLB2qVn8zQ9X7hYjKmN3pWrStUvXyZ4aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                    >
                      {showEncryptionKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Keep this key safe. You'll need it to decrypt your data if you migrate to
                    another instance.
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

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Export Key</p>
                      <p className="text-sm text-gray-600">Download encryption key for backup</p>
                    </div>
                  </div>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What's Encrypted */}
          <Card>
            <CardHeader>
              <CardTitle>Protected Data</CardTitle>
              <CardDescription>
                All sensitive data is encrypted using your master key
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Integration API Keys',
                  'Service Account JSONs',
                  'Database Credentials',
                  'OAuth Tokens',
                  'AI Provider Keys',
                  'Deployment Keys',
                  'SSH Keys',
                  'Environment Variables',
                  'Secret Configuration',
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle>Security Audit Log</CardTitle>
              <CardDescription>Recent security events and key operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { action: 'Encryption key viewed', time: '2 hours ago', type: 'info' },
                  { action: 'Integration credential added', time: '1 day ago', type: 'success' },
                  { action: 'AI provider key updated', time: '3 days ago', type: 'success' },
                  { action: 'Master key created', time: '5 days ago', type: 'success' },
                ].map((log, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2
                        className={`h-4 w-4 ${log.type === 'info' ? 'text-blue-600' : 'text-green-600'}`}
                      />
                      <span className="text-sm text-gray-900">{log.action}</span>
                    </div>
                    <span className="text-xs text-gray-500">{log.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
  );
}

export default function SecurityPage() {
  return (
    <Suspense
      fallback={
        <PageLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-muted-foreground">Loading security settings...</div>
          </div>
        </PageLayout>
      }
    >
      <SecurityContent />
    </Suspense>
  );
}
