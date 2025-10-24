'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FloatingInput } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Key,
  Copy,
  CheckCircle2,
  Pencil,
  Save,
  X,
  Plus,
  Trash2
} from 'lucide-react'

interface EnvironmentVariable {
  key: string
  description: string
  example?: string
  integration?: string
}

interface EnvironmentVariables {
  required?: EnvironmentVariable[]
  optional?: EnvironmentVariable[]
}

interface VariablesTabProps {
  environmentVariables?: EnvironmentVariables
  onSave: (variables: EnvironmentVariables) => Promise<void>
}

export function VariablesTab({ environmentVariables, onSave }: VariablesTabProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedVariables, setEditedVariables] = useState<EnvironmentVariables | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const requiredEnvCount = environmentVariables?.required?.length || 0
  const optionalEnvCount = environmentVariables?.optional?.length || 0
  const totalEnvCount = requiredEnvCount + optionalEnvCount

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleEdit = () => {
    setEditedVariables(JSON.parse(JSON.stringify(environmentVariables || { required: [], optional: [] })))
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!editedVariables) return
    setIsSaving(true)
    try {
      await onSave(editedVariables)
      setIsEditing(false)
      setEditedVariables(null)
    } catch (error) {
      console.error('Failed to save variables:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedVariables(null)
  }

  const handleUpdateVariable = (type: 'required' | 'optional', index: number, field: string, value: string) => {
    if (!editedVariables) return
    const updated = { ...editedVariables }
    if (!updated[type]) updated[type] = []
    updated[type]![index] = { ...updated[type]![index], [field]: value }
    setEditedVariables(updated)
  }

  const handleDeleteVariable = (type: 'required' | 'optional', index: number) => {
    if (!editedVariables) return
    const updated = { ...editedVariables }
    if (!updated[type]) return
    updated[type] = updated[type]!.filter((_, i) => i !== index)
    setEditedVariables(updated)
  }

  const handleAddVariable = (type: 'required' | 'optional') => {
    if (!editedVariables) return
    const updated = { ...editedVariables }
    if (!updated[type]) updated[type] = []
    updated[type] = [...updated[type]!, { key: '', description: '', example: '' }]
    setEditedVariables(updated)
  }

  const currentVariables = isEditing ? editedVariables : environmentVariables

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-ocean-600" />
            <CardTitle>Environment Variables</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {totalEnvCount} variable{totalEnvCount !== 1 ? 's' : ''}
            </Badge>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-ocean-600 to-ocean-500">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>
        <CardDescription>
          Configure these environment variables before deployment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentVariables ? (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="bg-gray-50">
              <TabsTrigger value="all" className="flex items-center gap-2">
                All Variables
                {totalEnvCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-ocean-100 text-ocean-700">
                    {totalEnvCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="required" className="flex items-center gap-2">
                Required
                {requiredEnvCount > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">
                    {requiredEnvCount}
                  </Badge>
                )}
              </TabsTrigger>
              {currentVariables.optional && currentVariables.optional.length > 0 && (
                <TabsTrigger value="optional" className="flex items-center gap-2">
                  Optional
                  <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">
                    {optionalEnvCount}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            {/* All Variables Tab */}
            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {/* Required Variables */}
                {currentVariables.required?.map((envVar, idx) => (
                  <VariableCard
                    key={`req-${idx}`}
                    variable={envVar}
                    type="required"
                    isEditing={isEditing}
                    onUpdate={(field, value) => handleUpdateVariable('required', idx, field, value)}
                    onDelete={() => handleDeleteVariable('required', idx)}
                    copiedKey={copiedKey}
                    onCopy={handleCopyKey}
                  />
                ))}

                {/* Optional Variables */}
                {currentVariables.optional?.map((envVar, idx) => (
                  <VariableCard
                    key={`opt-${idx}`}
                    variable={envVar}
                    type="optional"
                    isEditing={isEditing}
                    onUpdate={(field, value) => handleUpdateVariable('optional', idx, field, value)}
                    onDelete={() => handleDeleteVariable('optional', idx)}
                    copiedKey={copiedKey}
                    onCopy={handleCopyKey}
                  />
                ))}

                {isEditing && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAddVariable('required')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Required Variable
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAddVariable('optional')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Optional Variable
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Required Only Tab */}
            <TabsContent value="required" className="mt-6">
              <div className="space-y-4">
                {currentVariables.required?.map((envVar, idx) => (
                  <VariableCard
                    key={idx}
                    variable={envVar}
                    type="required"
                    isEditing={isEditing}
                    onUpdate={(field, value) => handleUpdateVariable('required', idx, field, value)}
                    onDelete={() => handleDeleteVariable('required', idx)}
                    copiedKey={copiedKey}
                    onCopy={handleCopyKey}
                  />
                ))}
                {isEditing && (
                  <Button variant="outline" size="sm" onClick={() => handleAddVariable('required')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Required Variable
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Optional Only Tab */}
            {currentVariables.optional && (
              <TabsContent value="optional" className="mt-6">
                <div className="space-y-4">
                  {currentVariables.optional.map((envVar, idx) => (
                    <VariableCard
                      key={idx}
                      variable={envVar}
                      type="optional"
                      isEditing={isEditing}
                      onUpdate={(field, value) => handleUpdateVariable('optional', idx, field, value)}
                      onDelete={() => handleDeleteVariable('optional', idx)}
                      copiedKey={copiedKey}
                      onCopy={handleCopyKey}
                    />
                  ))}
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={() => handleAddVariable('optional')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Optional Variable
                    </Button>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="text-center py-16">
            <Key className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">No environment variables detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Sub-component for rendering individual variable cards
interface VariableCardProps {
  variable: EnvironmentVariable
  type: 'required' | 'optional'
  isEditing: boolean
  onUpdate: (field: string, value: string) => void
  onDelete: () => void
  copiedKey: string | null
  onCopy: (key: string) => void
}

function VariableCard({ variable, type, isEditing, onUpdate, onDelete, copiedKey, onCopy }: VariableCardProps) {
  const isRequired = type === 'required'

  if (isEditing) {
    return (
      <div className={`border rounded-lg p-5 ${isRequired ? 'border-red-100 bg-red-50/30' : 'bg-gray-50/50'}`}>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-4">
              <FloatingInput
                label="Variable Key *"
                value={variable.key}
                onChange={(e) => onUpdate('key', e.target.value)}
                className="font-mono"
              />
              <Textarea
                value={variable.description}
                onChange={(e) => onUpdate('description', e.target.value)}
                placeholder="What is this variable used for? *"
                rows={3}
                className="text-sm resize-none rounded-xl border-2 border-ocean-200/60 hover:border-ocean-300/80 focus:border-ocean-500 focus:ring-4 focus:ring-ocean-500/20"
              />
              <FloatingInput
                label="Example Value (optional)"
                value={variable.example || ''}
                onChange={(e) => onUpdate('example', e.target.value)}
                className="font-mono"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // View mode
  return (
    <div className={`border rounded-lg p-5 ${isRequired ? 'border-red-100 bg-red-50/30' : 'bg-gray-50/50'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key className={`h-4 w-4 ${isRequired ? 'text-red-600' : 'text-gray-600'}`} />
          <code className="text-sm font-mono font-semibold text-gray-900">{variable.key}</code>
          <Badge variant={isRequired ? 'destructive' : 'secondary'} className="ml-2 text-xs">
            {isRequired ? 'Required' : 'Optional'}
          </Badge>
        </div>
        {variable.integration && (
          <Badge variant="secondary" className="text-xs">
            {variable.integration}
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-700 mb-3">{variable.description}</p>
      {variable.example && (
        <div className="flex items-center gap-2 p-3 bg-white rounded border text-sm">
          <span className="text-gray-500 font-medium">Example:</span>
          <code className="flex-1 font-mono text-gray-800">{variable.example}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(variable.example!)}
          >
            {copiedKey === variable.example ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
