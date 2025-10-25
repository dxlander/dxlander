"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { PageLayout, Header, Section } from "@/components/layouts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
    RefreshCw,
    Download,
    Upload,
    Clock,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Calendar,
    HardDrive,
    Shield
} from "lucide-react"

function BackupContent() {
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
    const [showRestoreDialog, setShowRestoreDialog] = useState(false)
    const [selectedBackup, setSelectedBackup] = useState<string | null>(null)

    const headerActions = (
        <div className="flex items-center gap-2">
            <Link href="/dashboard/settings">
                <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Settings
                </Button>
            </Link>
            <Button size="sm">
                <Database className="h-4 w-4 mr-2" />
                Create Backup Now
            </Button>
        </div>
    )

    const backups = [
        {
            id: '1',
            name: 'Automatic Backup',
            date: '2 hours ago',
            size: '2.4 MB',
            type: 'auto',
            status: 'success'
        },
        {
            id: '2',
            name: 'Manual Backup - Pre-update',
            date: '1 day ago',
            size: '2.3 MB',
            type: 'manual',
            status: 'success'
        },
        {
            id: '3',
            name: 'Automatic Backup',
            date: '1 day ago',
            size: '2.3 MB',
            type: 'auto',
            status: 'success'
        },
        {
            id: '4',
            name: 'Automatic Backup',
            date: '2 days ago',
            size: '2.2 MB',
            type: 'auto',
            status: 'success'
        },
        {
            id: '5',
            name: 'Manual Backup - Initial setup',
            date: '5 days ago',
            size: '1.8 MB',
            type: 'manual',
            status: 'success'
        }
    ]

    return (
        <PageLayout background="default">
            <Header
                title="Backup & Restore"
                subtitle="Manage database backups and restore points"
                actions={headerActions}
            />

            <Section spacing="lg" container={false}>
                <div className="max-w-5xl mx-auto px-6 space-y-6">

                    {/* Backup Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/50">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Last Backup</p>
                                        <p className="text-lg font-bold text-gray-900">2 hours ago</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <HardDrive className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Total Backups</p>
                                        <p className="text-lg font-bold text-gray-900">5 backups</p>
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
                                        <p className="text-xs text-gray-500 mb-1">Storage Used</p>
                                        <p className="text-lg font-bold text-gray-900">12.0 MB</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Automatic Backup Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Automatic Backup Schedule</CardTitle>
                            <CardDescription>
                                Configure automatic database backups to run on a schedule
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-gray-600" />
                                    <div>
                                        <p className="font-medium text-gray-900">Enable Automatic Backups</p>
                                        <p className="text-sm text-gray-600">Create backups on a recurring schedule</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={autoBackupEnabled}
                                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                                    className="h-5 w-5 rounded border-gray-300 text-ocean-600 focus:ring-ocean-500"
                                />
                            </div>

                            {autoBackupEnabled && (
                                <div className="space-y-4 pl-4 border-l-2 border-ocean-200">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="backup-frequency">Frequency</Label>
                                            <Select defaultValue="daily">
                                                <SelectTrigger id="backup-frequency">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="hourly">Every Hour</SelectItem>
                                                    <SelectItem value="daily">Daily</SelectItem>
                                                    <SelectItem value="weekly">Weekly</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="backup-time">Time</Label>
                                            <Input
                                                id="backup-time"
                                                type="time"
                                                defaultValue="02:00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="retention">Retention Period</Label>
                                        <Select defaultValue="30">
                                            <SelectTrigger id="retention">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7">Keep for 7 days</SelectItem>
                                                <SelectItem value="30">Keep for 30 days</SelectItem>
                                                <SelectItem value="90">Keep for 90 days</SelectItem>
                                                <SelectItem value="forever">Keep forever</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-900">
                                            <strong>Next backup:</strong> Today at 2:00 AM
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Backup List */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Backup History</CardTitle>
                                    <CardDescription>
                                        Available backup files and restore points
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import Backup
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {backups.map((backup) => (
                                    <div
                                        key={backup.id}
                                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-ocean-300 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${backup.type === 'manual' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                                                <Database className={`h-5 w-5 ${backup.type === 'manual' ? 'text-purple-600' : 'text-blue-600'}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-medium text-gray-900">{backup.name}</p>
                                                    <Badge variant="secondary" className={backup.type === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                                                        {backup.type === 'manual' ? 'Manual' : 'Auto'}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {backup.date}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <HardDrive className="h-3 w-3" />
                                                        {backup.size}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedBackup(backup.id)
                                                    setShowRestoreDialog(true)
                                                }}
                                            >
                                                <RefreshCw className="h-3 w-3 mr-1" />
                                                Restore
                                            </Button>
                                            <Button variant="outline" size="sm">
                                                <Download className="h-3 w-3 mr-1" />
                                                Export
                                            </Button>
                                            <Button variant="outline" size="sm">
                                                <Trash2 className="h-3 w-3 text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Storage Location */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Backup Storage</CardTitle>
                            <CardDescription>
                                Configure where backups are stored
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="backup-path">Local Backup Directory</Label>
                                <Input
                                    id="backup-path"
                                    value="~/.dxlander/backups"
                                    readOnly
                                    className="font-mono text-sm"
                                />
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-1">Backup Security</h4>
                                        <p className="text-sm text-gray-700">
                                            Backups are encrypted using your master encryption key. Keep your key safe to ensure you can restore from backups.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </Section>

            {/* Restore Confirmation Dialog */}
            <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restore from Backup</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to restore the database from this backup?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-1">Warning</h4>
                                    <ul className="text-sm text-gray-700 space-y-1">
                                        <li>• Current database will be replaced</li>
                                        <li>• All data after backup date will be lost</li>
                                        <li>• A backup of current state will be created first</li>
                                        <li>• This operation cannot be undone</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {selectedBackup && (
                            <div className="p-4 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2">Restoring from:</p>
                                <p className="font-medium text-gray-900">
                                    {backups.find(b => b.id === selectedBackup)?.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                    Created {backups.find(b => b.id === selectedBackup)?.date}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setShowRestoreDialog(false)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restore Database
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageLayout>
    )
}

export default function BackupPage() {
    return (
        <Suspense fallback={
            <PageLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-muted-foreground">Loading backup settings...</div>
                </div>
            </PageLayout>
        }>
            <BackupContent />
        </Suspense>
    )
}
