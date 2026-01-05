'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Database,
  Key,
  Zap,
  Shield,
  RefreshCw,
  CheckCircle2,
  Server,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

function SettingsContent() {
  const [hasCustomKey] = useState(true);

  const headerActions = (
    <Link href="/dashboard">
      <Button variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
    </Link>
  );

  return (
    <PageLayout background="default">
      <Header
        title="Settings"
        subtitle="Manage your DXLander instance configuration"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          {/* Quick Settings Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* AI Providers */}
            <Link href="/dashboard/settings/ai-providers">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Zap className="h-6 w-6 text-purple-600" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI Providers</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Configure AI models for code analysis and generation
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      2 Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Deployment Targets */}
            <Link href="/dashboard/deployments">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-ocean-100 rounded-lg">
                      <Server className="h-6 w-6 text-ocean-600" />
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Deployment Targets</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Manage platform credentials (Vercel, Railway, AWS)
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      5 Platforms
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Secret Manager */}
            <Link href="/dashboard/secrets">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Key className="h-6 w-6 text-blue-600" />
                    </div>
                    <ExternalLink className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Secret Manager</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Securely stored credentials and API keys
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      Encrypted
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Database */}
            <Link href="/dashboard/settings/database">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Database className="h-6 w-6 text-green-600" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Database</h3>
                  <p className="text-sm text-gray-600 mb-3">SQLite • 2.4 MB • 12 projects</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Security & Encryption */}
            <Link href="/dashboard/settings/security">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer border-2 border-ocean-200 bg-gradient-to-br from-ocean-50/50 to-blue-50/50 md:col-span-2 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-ocean-100 rounded-lg">
                      <Shield className="h-6 w-6 text-ocean-600" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-ocean-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Security & Encryption</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Master encryption key protects all credentials with AES-256-GCM
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {hasCustomKey ? 'Custom Key' : 'System Generated'}
                    </Badge>
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      Created 5 days ago
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Backup & Restore */}
            <Link href="/dashboard/settings/backup">
              <Card className="hover:shadow-elegant transition-all hover:border-ocean-300 cursor-pointer border-gray-200 bg-gray-50 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gray-200 rounded-lg">
                      <RefreshCw className="h-6 w-6 text-gray-600" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Backup & Restore</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Manage database backups, restore points, and automatic backup schedules
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Auto-backup enabled
                    </Badge>
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      Last backup: 2 hours ago
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <PageLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-muted-foreground">Loading settings...</div>
          </div>
        </PageLayout>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
