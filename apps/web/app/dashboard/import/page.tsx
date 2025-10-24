"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { PageLayout, Header, Section } from "@/components/layouts"
import { IconWrapper } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FloatingInput, Input } from "@/components/ui/input"
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
  Github,
  Upload,
  GitBranch,
  Globe,
  FolderGit2,
  CheckCircle2,
  Shield,
  Rocket,
  Package,
  Archive,
  Link2,
  Search,
  Star,
  ArrowRight,
  AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc"
import { config } from "@/lib/config"

type ImportMethod = 'github' | 'zip' | 'git' | 'gitlab' | 'bitbucket'

export default function ImportPage() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod>('github')
  const [isImporting, setIsImporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // GitHub form state
  const [githubUrl, setGithubUrl] = useState('')
  const [githubBranch, setGithubBranch] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [githubRepoType, setGithubRepoType] = useState<'public' | 'private'>('public')
  const [projectName, setProjectName] = useState('')

  // ZIP upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // tRPC mutation
  const importGitHub = trpc.projects.importFromGitHub.useMutation({
    onSuccess: (data) => {
      console.log('Import successful:', data)
      // Redirect to project detail page
      router.push(`/project/${data.project.id}`)
    },
    onError: (error) => {
      console.error('Import failed:', error)
      setError(error.message)
      setIsImporting(false)
    }
  })

  const importMethods = [
    {
      id: 'github' as ImportMethod,
      name: 'GitHub',
      icon: <Github className="h-5 w-5" />,
      description: 'Import from public or private repositories',
      popular: true,
    },
    {
      id: 'zip' as ImportMethod,
      name: 'ZIP Upload',
      icon: <Upload className="h-5 w-5" />,
      description: 'Upload project as ZIP archive',
      popular: true,
    },
    {
      id: 'gitlab' as ImportMethod,
      name: 'GitLab',
      icon: <FolderGit2 className="h-5 w-5" />,
      description: 'Import from GitLab repositories',
      popular: false,
    },
    {
      id: 'bitbucket' as ImportMethod,
      name: 'Bitbucket',
      icon: <GitBranch className="h-5 w-5" />,
      description: 'Import from Bitbucket repositories',
      popular: false,
    },
    {
      id: 'git' as ImportMethod,
      name: 'Git URL',
      icon: <Globe className="h-5 w-5" />,
      description: 'Clone from any Git repository URL',
      popular: false,
    }
  ]

  const filteredMethods = importMethods.filter(method =>
    method.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    method.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleImport = async () => {
    setError(null)
    setIsImporting(true)

    try {
      if (selectedMethod === 'github') {
        // Validate GitHub URL
        if (!githubUrl.trim()) {
          setError('Please enter a GitHub repository URL')
          setIsImporting(false)
          return
        }

        // Call API
        await importGitHub.mutateAsync({
          repoUrl: githubUrl.trim(),
          branch: githubBranch || undefined,
          token: githubToken || undefined,
          projectName: projectName || undefined
        })
      } else if (selectedMethod === 'zip') {
        // Validate file is selected
        if (!selectedFile) {
          setError('Please select a ZIP file to upload')
          setIsImporting(false)
          return
        }

        // Create form data
        const formData = new FormData()
        formData.append('file', selectedFile)
        if (projectName) {
          formData.append('projectName', projectName)
        }

        // Get auth token
        const token = localStorage.getItem('dxlander-token')
        if (!token) {
          throw new Error('Authentication required. Please log in again.')
        }

        // Upload ZIP file
        const response = await fetch(`${config.apiUrl}/upload/zip`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to upload ZIP file')
        }

        console.log('ZIP upload successful:', data)
        router.push(`/project/${data.project.id}`)
      } else {
        // Other import methods not yet implemented
        setError(`${selectedMethod} import not yet implemented`)
        setIsImporting(false)
      }
    } catch (err: any) {
      console.error('Import error:', err)
      setError(err.message || 'Import failed')
      setIsImporting(false)
    }
  }

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length === 0) return

    const file = files[0]
    if (file.name.endsWith('.zip')) {
      setSelectedFile(file)
      setError(null)
    } else {
      setError('Please drop a ZIP file')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.name.endsWith('.zip')) {
      setSelectedFile(file)
      setError(null)
    } else {
      setError('Please select a ZIP file')
    }
  }, [])

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
        title="Import Project"
        subtitle="Import your project to generate build configurations"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[380px_1fr] gap-6">

            {/* Left Sidebar - Import Methods */}
            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Import Source</h2>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search import methods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Method List */}
              <div className="space-y-2">
                {filteredMethods.map((method) => {
                  // Enable GitHub and ZIP, disable others
                  const isDisabled = method.id !== 'zip' && method.id !== 'github'
                  return (
                    <button
                      key={method.id}
                      onClick={() => !isDisabled && setSelectedMethod(method.id)}
                      disabled={isDisabled}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : selectedMethod === method.id
                            ? 'border-ocean-500 bg-ocean-50 shadow-md cursor-pointer'
                            : 'border-gray-200 hover:border-ocean-300 hover:bg-gray-50 cursor-pointer'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isDisabled
                            ? 'bg-gray-100 text-gray-400'
                            : selectedMethod === method.id
                              ? 'bg-ocean-100 text-ocean-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                              {method.name}
                            </h3>
                            {method.popular && !isDisabled && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                                <Star className="h-3 w-3 mr-1 fill-amber-600" />
                                Popular
                              </Badge>
                            )}
                            {isDisabled && (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                                Coming Soon
                              </Badge>
                            )}
                          </div>
                          <p className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                            {method.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Info Card */}
              <Card className="border-ocean-200 bg-gradient-to-br from-ocean-50 to-blue-50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-ocean-600" />
                    <h4 className="font-semibold text-gray-900 text-sm">Enterprise Security</h4>
                  </div>
                  <div className="space-y-2 text-xs text-gray-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span>End-to-end encryption</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span>Zero data retention</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span>Private code analysis</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Import Form */}
            <Card className="shadow-elegant-lg h-fit">
              <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-ocean-50/30">
                <div className="flex items-center gap-3">
                  <IconWrapper variant="primary" size="md">
                    {importMethods.find(m => m.id === selectedMethod)?.icon}
                  </IconWrapper>
                  <div className="flex-1">
                    <CardTitle>Import from {importMethods.find(m => m.id === selectedMethod)?.name}</CardTitle>
                    <CardDescription>
                      {selectedMethod === 'github' && 'Connect your GitHub repository to generate build configurations'}
                      {selectedMethod === 'gitlab' && 'Connect your GitLab repository to generate build configurations'}
                      {selectedMethod === 'bitbucket' && 'Connect your Bitbucket repository to generate build configurations'}
                      {selectedMethod === 'zip' && 'Upload your project files to generate build configurations'}
                      {selectedMethod === 'git' && 'Clone from any Git repository to generate build configurations'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">

                {/* Error Banner */}
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Import Failed</p>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {/* GitHub Import */}
                {selectedMethod === 'github' && (
                  <>
                    <div className="space-y-4">
                      <FloatingInput
                        label="Repository URL or Owner/Repo"
                        leftIcon={<Github className="h-4 w-4" />}
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        disabled={isImporting}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FloatingInput
                          label="Branch (Optional)"
                          leftIcon={<GitBranch className="h-4 w-4" />}
                          value={githubBranch}
                          onChange={(e) => setGithubBranch(e.target.value)}
                          disabled={isImporting}
                        />
                        <div className="space-y-2">
                          <Label>Repository Type</Label>
                          <Select
                            value={githubRepoType}
                            onValueChange={(value) => setGithubRepoType(value as 'public' | 'private')}
                            disabled={isImporting}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Public Repository</SelectItem>
                              <SelectItem value="private">Private Repository</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {githubRepoType === 'private' && (
                        <FloatingInput
                          label="Personal Access Token"
                          type="password"
                          leftIcon={<Shield className="h-4 w-4" />}
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          disabled={isImporting}
                        />
                      )}

                      <FloatingInput
                        label="Project Name (Optional)"
                        leftIcon={<Package className="h-4 w-4" />}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1 text-sm text-gray-700">
                          <p className="font-medium mb-1">Quick Setup</p>
                          <p>Example: <code className="bg-white px-2 py-0.5 rounded text-ocean-600 font-mono text-xs">username/repo-name</code> or full URL</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* GitLab Import */}
                {selectedMethod === 'gitlab' && (
                  <>
                    <div className="space-y-4">
                      <FloatingInput
                        label="GitLab Project URL"
                        leftIcon={<FolderGit2 className="h-4 w-4" />}
                      />

                      <FloatingInput
                        label="Branch"
                        leftIcon={<GitBranch className="h-4 w-4" />}
                        defaultValue="main"
                      />

                      <FloatingInput
                        label="Personal Access Token"
                        type="password"
                        leftIcon={<Shield className="h-4 w-4" />}
                      />
                    </div>

                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <FolderGit2 className="h-5 w-5 text-purple-600 mt-0.5" />
                        <div className="flex-1 text-sm text-gray-700">
                          <p className="font-medium mb-1">GitLab Integration</p>
                          <p>Supports GitLab CI/CD pipeline integration and automatic deployments</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Bitbucket Import */}
                {selectedMethod === 'bitbucket' && (
                  <>
                    <div className="space-y-4">
                      <FloatingInput
                        label="Bitbucket Repository URL"
                        leftIcon={<GitBranch className="h-4 w-4" />}
                      />

                      <FloatingInput
                        label="Branch"
                        leftIcon={<GitBranch className="h-4 w-4" />}
                        defaultValue="main"
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FloatingInput
                          label="Username"
                          leftIcon={<Github className="h-4 w-4" />}
                        />
                        <FloatingInput
                          label="App Password"
                          type="password"
                          leftIcon={<Shield className="h-4 w-4" />}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ZIP Upload */}
                {selectedMethod === 'zip' && (
                  <>
                    <div className="space-y-4">
                      <FloatingInput
                        label="Project Name (Optional)"
                        leftIcon={<Package className="h-4 w-4" />}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isImporting}
                      />

                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-input')?.click()}
                        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group ${isDragging
                            ? 'border-ocean-500 bg-ocean-100'
                            : selectedFile
                              ? 'border-green-400 bg-green-50'
                              : 'border-ocean-300 bg-gradient-to-br from-ocean-50/50 to-blue-50/50 hover:border-ocean-400'
                          }`}
                      >
                        <input
                          id="file-input"
                          type="file"
                          accept=".zip"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isImporting}
                        />
                        <div className="flex flex-col items-center gap-4">
                          <div className={`p-4 rounded-full transition-colors ${selectedFile
                              ? 'bg-green-100'
                              : 'bg-ocean-100 group-hover:bg-ocean-200'
                            }`}>
                            {selectedFile ? (
                              <CheckCircle2 className="h-10 w-10 text-green-600" />
                            ) : (
                              <Upload className="h-10 w-10 text-ocean-600" />
                            )}
                          </div>
                          <div>
                            {selectedFile ? (
                              <>
                                <p className="text-lg font-semibold text-gray-900 mb-1">
                                  {selectedFile.name}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <p className="text-xs text-ocean-600 mt-2">
                                  Click to change file
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-lg font-semibold text-gray-900 mb-1">
                                  <span className="text-ocean-600">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-sm text-gray-600">ZIP archive up to 500MB</p>
                              </>
                            )}
                          </div>
                          {!selectedFile && (
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <Archive className="h-4 w-4" />
                                <span>.zip</span>
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1.5">
                                <Package className="h-4 w-4" />
                                <span>Source code</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-gray-700">No account required</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-gray-700">Quick import</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Git URL Import */}
                {selectedMethod === 'git' && (
                  <>
                    <div className="space-y-4">
                      <FloatingInput
                        label="Git Repository URL"
                        leftIcon={<Link2 className="h-4 w-4" />}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FloatingInput
                          label="Branch"
                          leftIcon={<GitBranch className="h-4 w-4" />}
                          defaultValue="main"
                        />
                        <div className="space-y-2">
                          <Label>Clone Method</Label>
                          <Select defaultValue="https">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="https">HTTPS</SelectItem>
                              <SelectItem value="ssh">SSH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <FloatingInput
                        label="Authentication (if required)"
                        type="password"
                        leftIcon={<Shield className="h-4 w-4" />}
                      />
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div className="flex-1 text-sm text-gray-700">
                          <p className="font-medium mb-1">Universal Git Support</p>
                          <p>Works with any Git hosting provider: GitHub, GitLab, Bitbucket, or self-hosted</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Import Actions */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>All imports are encrypted and secure</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                      <Button variant="outline">Cancel</Button>
                    </Link>
                    <Button
                      size="lg"
                      onClick={handleImport}
                      disabled={isImporting}
                      className="bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-700 hover:to-ocean-600"
                    >
                      {isImporting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Import Project
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </PageLayout>
  )
}
