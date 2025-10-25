"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { PageLayout, Header, Section } from "@/components/layouts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input, FloatingInput } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    Database,
    CheckCircle2,
    Activity,
    HardDrive,
    Clock,
    Save,
    RefreshCw
} from "lucide-react"

function DatabaseContent() {
    const [databaseType, setDatabaseType] = useState("sqlite")

    const headerActions = (
        <div className="flex items-center gap-2">
            <Link href="/dashboard/settings">
                <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Settings
                </Button>
            </Link>
            <Button size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
            </Button>
        </div>
    )

    return (
        <PageLayout background="default">
            <Header
                title="Database Configuration"
                subtitle="Manage database connection, storage, and performance settings"
                actions={headerActions}
            />

            <Section spacing="lg" container={false}>
                <div className="max-w-5xl mx-auto px-6 space-y-6">

                    {/* Current Database Status */}
                    <Card className="border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/50">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-green-100 rounded-lg">
                                        <Database className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">Database Connected</h3>
                                        <p className="text-sm text-gray-700 mb-3">
                                            SQLite • <code className="bg-white/50 px-1 rounded">~/.dxlander/data/dxlander.db</code>
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Healthy
                                            </Badge>
                                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                                                2.4 MB
                                            </Badge>
                                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                                                12 Projects
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <Button variant="outline">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Test Connection
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Database Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <HardDrive className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Total Size</p>
                                        <p className="text-2xl font-bold text-gray-900">2.4 MB</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Database className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Tables</p>
                                        <p className="text-2xl font-bold text-gray-900">8</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <Activity className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Records</p>
                                        <p className="text-2xl font-bold text-gray-900">1,234</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Clock className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Last Query</p>
                                        <p className="text-sm font-semibold text-gray-900">2 min ago</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Database Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Database Type</CardTitle>
                            <CardDescription>
                                Choose your database engine and configure connection settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="database-type">Database Engine</Label>
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
                                            Test PostgreSQL Connection
                                        </Button>
                                    </>
                                )}

                                {databaseType === 'mysql' && (
                                    <>
                                        <div className="space-y-2">
                                            <FloatingInput
                                                label="Host"
                                                leftIcon={<Database className="h-4 w-4" />}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <FloatingInput label="Port" type="number" defaultValue="3306" />
                                            </div>
                                            <div className="space-y-2">
                                                <FloatingInput label="Database Name" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <FloatingInput label="Username" />
                                            </div>
                                            <div className="space-y-2">
                                                <FloatingInput label="Password" type="password" />
                                            </div>
                                        </div>

                                        <Button variant="outline" className="w-full">
                                            <CheckCircle2 className="h-4 w-4 mr-2" />
                                            Test MySQL Connection
                                        </Button>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Storage Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Storage Breakdown</CardTitle>
                            <CardDescription>
                                Database space usage by entity type
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[
                                    { name: 'Projects', count: 12, size: '1.2 MB', color: 'bg-blue-500' },
                                    { name: 'Configurations', count: 45, size: '680 KB', color: 'bg-purple-500' },
                                    { name: 'Integrations', count: 5, size: '240 KB', color: 'bg-green-500' },
                                    { name: 'Deployment Credentials', count: 8, size: '180 KB', color: 'bg-ocean-500' },
                                    { name: 'Analysis Results', count: 23, size: '120 KB', color: 'bg-amber-500' }
                                ].map((item, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                                    {item.count} records
                                                </Badge>
                                            </div>
                                            <span className="text-sm text-gray-600">{item.size}</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${item.color}`} style={{ width: `${(parseFloat(item.size) / 2.4) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Maintenance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Database Maintenance</CardTitle>
                            <CardDescription>
                                Optimize performance and manage database health
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 border border-gray-200 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-2">Vacuum Database</h4>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Reclaim unused space and optimize performance
                                    </p>
                                    <Button variant="outline" className="w-full">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Run Vacuum
                                    </Button>
                                </div>

                                <div className="p-4 border border-gray-200 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-2">Analyze Tables</h4>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Update statistics for query optimization
                                    </p>
                                    <Button variant="outline" className="w-full">
                                        <Activity className="h-4 w-4 mr-2" />
                                        Analyze Now
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </Section>
        </PageLayout>
    )
}

export default function DatabasePage() {
    return (
        <Suspense fallback={
            <PageLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-muted-foreground">Loading database settings...</div>
                </div>
            </PageLayout>
        }>
            <DatabaseContent />
        </Suspense>
    )
}
