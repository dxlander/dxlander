'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { PageLayout, Header, Section } from '@/components/layouts';
import { IconWrapper } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Github,
  Upload,
  CheckCircle2,
  Shield,
  Rocket,
  Search,
  Star,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { config } from '@/lib/config';

type ImportMethod = 'github' | 'zip' | 'gitlab' | 'bitbucket';

export default function ImportPage() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod>('github');
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // GitHub form state
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [projectName, setProjectName] = useState('');

  // GitLab form state
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [gitlabToken, setGitlabToken] = useState('');
  const [gitlabProject, setGitlabProject] = useState('');
  const [gitlabBranch, setGitlabBranch] = useState('');

  // Bitbucket form state
  const [bitbucketUsername, setBitbucketUsername] = useState('');
  const [bitbucketPassword, setBitbucketPassword] = useState('');
  const [bitbucketWorkspace, setBitbucketWorkspace] = useState('');
  const [bitbucketRepo, setBitbucketRepo] = useState('');
  const [bitbucketBranch, setBitbucketBranch] = useState('');
  const [bitbucketProjectName, setBitbucketProjectName] = useState('');

  // ZIP upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // tRPC mutation
  const importProject = trpc.projects.import.useMutation({
    onSuccess: (data) => {
      console.log('Import successful:', data);
      router.push(`/project/${data.project.id}`);
    },
    onError: (error) => {
      console.error('Import failed:', error);
      setError(error.message);
      setIsImporting(false);
    },
  });

  const importMethods = [
    {
      id: 'github' as ImportMethod,
      name: 'GitHub',
      icon: <Github className="h-5 w-5" />,
      description: 'Import from public or private repositories',
      popular: true,
      enabled: true,
    },
    {
      id: 'gitlab' as ImportMethod,
      name: 'GitLab',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
      ),
      description: 'Import from GitLab repositories',
      popular: false,
      enabled: true,
    },
    {
      id: 'bitbucket' as ImportMethod,
      name: 'Bitbucket',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
        </svg>
      ),
      description: 'Import from Bitbucket repositories',
      popular: false,
      enabled: true,
    },
    {
      id: 'zip' as ImportMethod,
      name: 'ZIP Upload',
      icon: <Upload className="h-5 w-5" />,
      description: 'Upload project as ZIP archive',
      popular: true,
      enabled: true,
    },
  ];

  const filteredMethods = importMethods.filter(
    (method) =>
      method.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      method.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = async () => {
    setError(null);
    setIsImporting(true);

    try {
      if (selectedMethod === 'github') {
        if (!githubUrl.trim()) {
          setError('Please enter a GitHub repository URL');
          setIsImporting(false);
          return;
        }

        await importProject.mutateAsync({
          sourceType: 'github',
          repoUrl: githubUrl.trim(),
          branch: githubBranch || undefined,
          token: githubToken || undefined,
          projectName: projectName || undefined,
        });
      } else if (selectedMethod === 'gitlab') {
        if (!gitlabToken.trim() || !gitlabProject.trim()) {
          setError('Please enter GitLab token and project');
          setIsImporting(false);
          return;
        }

        await importProject.mutateAsync({
          sourceType: 'gitlab',
          gitlabUrl: gitlabUrl || undefined,
          gitlabToken: gitlabToken,
          gitlabProject: gitlabProject,
          gitlabBranch: gitlabBranch || undefined,
          projectName: projectName || undefined,
        });
      } else if (selectedMethod === 'bitbucket') {
        if (!bitbucketUsername || !bitbucketPassword || !bitbucketWorkspace || !bitbucketRepo) {
          setError('Please fill all Bitbucket fields');
          setIsImporting(false);
          return;
        }

        await importProject.mutateAsync({
          sourceType: 'bitbucket',
          bitbucketUsername: bitbucketUsername,
          bitbucketPassword: bitbucketPassword,
          bitbucketWorkspace: bitbucketWorkspace,
          bitbucketRepo: bitbucketRepo,
          bitbucketBranch: bitbucketBranch || undefined,
          projectName: bitbucketProjectName || undefined,
        });
      } else if (selectedMethod === 'zip') {
        if (!selectedFile) {
          setError('Please select a ZIP file to upload');
          setIsImporting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (projectName) {
          formData.append('projectName', projectName);
        }

        const token = localStorage.getItem('dxlander-token');
        if (!token) {
          throw new Error('Authentication required. Please log in again.');
        }

        const response = await fetch(`${config.apiUrl}/upload/zip`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to upload ZIP file');
        }

        console.log('ZIP upload successful:', data);
        router.push(`/project/${data.project.id}`);
      }
    } catch (err: unknown) {
      console.error('Import error:', err);
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      setIsImporting(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (file.name.endsWith('.zip')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please drop a ZIP file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.name.endsWith('.zip')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please select a ZIP file');
    }
  }, []);

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
        title="Import Project"
        subtitle="Import your project to generate build configurations"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[380px_1fr] gap-6">
            {/* Left Sidebar */}
            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Import Source</h2>

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

              <div className="space-y-2">
                {filteredMethods.map((method) => {
                  const isDisabled = !method.enabled;
                  return (
                    <button
                      key={method.id}
                      onClick={() => !isDisabled && setSelectedMethod(method.id)}
                      disabled={isDisabled}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isDisabled
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : selectedMethod === method.id
                            ? 'border-ocean-500 bg-ocean-50 shadow-md cursor-pointer'
                            : 'border-gray-200 hover:border-ocean-300 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isDisabled
                              ? 'bg-gray-100 text-gray-400'
                              : selectedMethod === method.id
                                ? 'bg-ocean-100 text-ocean-600'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {method.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={`font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}
                            >
                              {method.name}
                            </h3>
                            {method.popular && !isDisabled && (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 text-amber-700 border-amber-200 text-xs"
                              >
                                <Star className="h-3 w-3 mr-1 fill-amber-600" />
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p
                            className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}
                          >
                            {method.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

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

            {/* Right Panel */}
            <Card className="shadow-elegant-lg h-fit">
              <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-ocean-50/30">
                <div className="flex items-center gap-3">
                  <IconWrapper variant="primary" size="md">
                    {importMethods.find((m) => m.id === selectedMethod)?.icon}
                  </IconWrapper>
                  <div className="flex-1">
                    <CardTitle>
                      Import from {importMethods.find((m) => m.id === selectedMethod)?.name}
                    </CardTitle>
                    <CardDescription>
                      Connect your repository to generate build configurations
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">Import Failed</p>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {/* GitHub Form */}
                {selectedMethod === 'github' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Repository URL or Owner/Repo</Label>
                      <Input
                        placeholder="username/repo or https://github.com/username/repo"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Branch (optional)</Label>
                      <Input
                        placeholder="main"
                        value={githubBranch}
                        onChange={(e) => setGithubBranch(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Personal Access Token (for private repos)</Label>
                      <Input
                        type="password"
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Name (optional)</Label>
                      <Input
                        placeholder="my-project"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>
                  </div>
                )}

                {/* GitLab Form */}
                {selectedMethod === 'gitlab' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>GitLab Instance URL (optional)</Label>
                      <Input
                        placeholder="https://gitlab.com (default)"
                        value={gitlabUrl}
                        onChange={(e) => setGitlabUrl(e.target.value)}
                        disabled={isImporting}
                      />
                      <p className="text-sm text-muted-foreground">
                        Leave empty for GitLab.com, or enter your self-hosted URL
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Personal Access Token *</Label>
                      <Input
                        type="password"
                        placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                        value={gitlabToken}
                        onChange={(e) => setGitlabToken(e.target.value)}
                        disabled={isImporting}
                      />
                      <p className="text-sm text-muted-foreground">
                        Create token at GitLab → Settings → Access Tokens (api + read_repository
                        scopes)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Project ID or Namespace/Project *</Label>
                      <Input
                        placeholder="12345 or username/project-name"
                        value={gitlabProject}
                        onChange={(e) => setGitlabProject(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Branch (optional)</Label>
                      <Input
                        placeholder="main"
                        value={gitlabBranch}
                        onChange={(e) => setGitlabBranch(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>
                  </div>
                )}

                {/* Bitbucket Form */}
                {selectedMethod === 'bitbucket' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username *</Label>
                      <Input
                        placeholder="your-username"
                        value={bitbucketUsername}
                        onChange={(e) => setBitbucketUsername(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>App Password *</Label>
                      <Input
                        type="password"
                        placeholder="App password"
                        value={bitbucketPassword}
                        onChange={(e) => setBitbucketPassword(e.target.value)}
                        disabled={isImporting}
                      />
                      <p className="text-sm text-muted-foreground">
                        Create at Bitbucket → Settings → App passwords (Repositories: Read)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Workspace *</Label>
                      <Input
                        placeholder="your-workspace"
                        value={bitbucketWorkspace}
                        onChange={(e) => setBitbucketWorkspace(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Repository Slug *</Label>
                      <Input
                        placeholder="repository-name"
                        value={bitbucketRepo}
                        onChange={(e) => setBitbucketRepo(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Project Name (optional)</Label>
                      <Input
                        placeholder="project-name"
                        value={bitbucketProjectName}
                        onChange={(e) => setBitbucketProjectName(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Branch (optional)</Label>
                      <Input
                        placeholder="main"
                        value={bitbucketBranch}
                        onChange={(e) => setBitbucketBranch(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>
                  </div>
                )}

                {/* ZIP Upload */}
                {selectedMethod === 'zip' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Project Name (optional)</Label>
                      <Input
                        placeholder="my-project"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        disabled={isImporting}
                      />
                    </div>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-input')?.click()}
                      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group ${
                        isDragging
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
                        <div
                          className={`p-4 rounded-full transition-colors ${
                            selectedFile ? 'bg-green-100' : 'bg-ocean-100 group-hover:bg-ocean-200'
                          }`}
                        >
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
                              <p className="text-xs text-ocean-600 mt-2">Click to change file</p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-semibold text-gray-900 mb-1">
                                <span className="text-ocean-600">Click to upload</span> or drag and
                                drop
                              </p>
                              <p className="text-sm text-gray-600">ZIP archive up to 500MB</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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
  );
}
