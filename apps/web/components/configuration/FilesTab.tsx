'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  FileCode,
  Copy,
  CheckCircle2,
  Info,
  Pencil,
  Save,
  X
} from 'lucide-react'

interface ConfigFile {
  id: string
  fileName: string
  content: string
  description?: string
}

interface FilesTabProps {
  files: ConfigFile[]
  onSaveFile: (fileName: string, content: string) => Promise<void>
}

export function FilesTab({ files, onSaveFile }: FilesTabProps) {
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [copiedFile, setCopiedFile] = useState<string | null>(null)

  const configFiles = files.filter(f => f.fileName !== '_summary.json')
  const configFilesCount = configFiles.length

  const handleCopyFile = (fileName: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedFile(fileName)
    setTimeout(() => setCopiedFile(null), 2000)
  }

  const handleEditFile = (fileName: string, content: string) => {
    setEditingFile(fileName)
    setEditedContent(content)
  }

  const handleSaveFile = async (fileName: string) => {
    setIsSaving(true)
    try {
      await onSaveFile(fileName, editedContent)
      setEditingFile(null)
      setEditedContent('')
    } catch (error) {
      console.error('Failed to save file:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingFile(null)
    setEditedContent('')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-ocean-600" />
            <CardTitle>Generated Configuration Files</CardTitle>
          </div>
          <Badge variant="outline">
            {configFilesCount} file{configFilesCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        <CardDescription>
          Production-ready configuration files for your deployment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {configFiles.length > 0 ? (
          <Tabs defaultValue={configFiles[0]?.fileName || ''} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto bg-gray-50">
              {configFiles.map((file) => (
                <TabsTrigger key={file.id} value={file.fileName} className="font-mono text-sm">
                  {file.fileName}
                </TabsTrigger>
              ))}
            </TabsList>

            {configFiles.map((file) => {
              const isEditing = editingFile === file.fileName
              const displayContent = isEditing ? editedContent : file.content

              return (
                <TabsContent key={file.id} value={file.fileName} className="mt-6">
                  <div className="space-y-4">
                    {file.description && (
                      <div className="flex items-start gap-3 p-4 bg-ocean-50 rounded-lg border border-ocean-100">
                        <Info className="h-5 w-5 text-ocean-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-ocean-900">{file.description}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-mono text-sm text-gray-700">{file.fileName}</h4>
                      {!isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditFile(file.fileName, file.content)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyFile(file.fileName, file.content)}
                          >
                            {copiedFile === file.fileName ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveFile(file.fileName)}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      {isEditing ? (
                        <Textarea
                          value={displayContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full min-h-[500px] bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent resize-y"
                          spellCheck={false}
                        />
                      ) : (
                        <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto max-h-[600px] border border-gray-700">
                          <code className="text-sm font-mono leading-relaxed">{displayContent}</code>
                        </pre>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      {displayContent.split('\n').length} lines
                    </p>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        ) : (
          <div className="text-center py-16">
            <FileCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">
              No configuration files available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
