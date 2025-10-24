"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageLayout, Header, Section } from "@/components/layouts"
import { IconWrapper } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FloatingInput } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  User,
  Database,
  Brain,
  CheckCircle2,
  AlertCircle,
  Shield
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { trpc } from "@/lib/trpc"

export default function SimplifiedSetup() {
  const router = useRouter()
  const [step, setStep] = useState<'welcome' | 'admin' | 'complete'>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [useDefaults, setUseDefaults] = useState(true)
  const [config, setConfig] = useState({
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    aiApiKey: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // tRPC hooks
  const setupMutation = trpc.setup.completeSetup.useMutation({
    onSuccess: (data) => {
      // Store the JWT token in both localStorage and cookie
      localStorage.setItem('dxlander-token', data.token)
      // Set cookie with 7-day expiry
      document.cookie = `dxlander-token=${data.token}; path=/; max-age=604800; SameSite=Strict`
      setStep('complete')
    },
    onError: (error) => {
      console.error('Setup failed:', error)
      setErrors({ general: error.message })
    },
    onSettled: () => {
      setIsLoading(false)
    }
  })

  const updateConfig = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }))
    }
  }

  const validateAdminForm = () => {
    const newErrors: Record<string, string> = {}

    if (!config.adminEmail) {
      newErrors.adminEmail = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(config.adminEmail)) {
      newErrors.adminEmail = 'Valid email is required'
    }

    if (!config.adminPassword) {
      newErrors.adminPassword = 'Password is required'
    } else if (config.adminPassword.length < 8) {
      newErrors.adminPassword = 'Password must be at least 8 characters'
    }

    if (config.adminPassword !== config.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('admin')
    } else if (step === 'admin') {
      if (validateAdminForm()) {
        completeSetup()
      }
    }
  }

  const completeSetup = async () => {
    setIsLoading(true)
    setErrors({}) // Clear previous errors

    try {
      await setupMutation.mutateAsync({
        adminEmail: config.adminEmail,
        adminPassword: config.adminPassword,
        confirmPassword: config.confirmPassword,
        useDefaults: true,
        aiApiKey: config.aiApiKey || undefined
      })
    } catch (error) {
      // Error handling is done in the mutation onError callback
    }
  }

  const skipToDefaults = async () => {
    setIsLoading(true)
    setErrors({}) // Clear previous errors

    try {
      await setupMutation.mutateAsync({
        adminEmail: 'admin@dxlander.local',
        adminPassword: 'admin123456',
        confirmPassword: 'admin123456',
        useDefaults: true
      })
    } catch (error) {
      // Error handling is done in the mutation onError callback
    }
  }

  const headerActions = (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary">Setup</Badge>
      <Link href="/design-system">
        <Button variant="ghost" size="sm">
          Design System
        </Button>
      </Link>
    </div>
  )

  return (
    <PageLayout background="default">
      <Header
        title="DXLander"
        subtitle="AI-Powered Deployment Automation"
        actions={headerActions}
      />

      <Section spacing="lg" container={false}>
        <div className="max-w-2xl mx-auto px-6">
          <Card variant="default" className="min-h-[500px] bg-white border-ocean-200/40 shadow-xl">

            {/* Welcome Step */}
            {step === 'welcome' && (
              <div className="p-8 text-center">
                <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center">
                  <Image
                    src="/logo.svg"
                    alt="DXLander"
                    width={64}
                    height={64}
                    className="h-16 w-16"
                  />
                </div>

                <h1 className="text-3xl font-bold mb-4 text-gray-900">
                  Welcome to DXLander
                </h1>

                <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
                  Your AI-powered deployment automation platform. Create workflows,
                  analyze projects, and deploy with confidence.
                </p>

                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="text-center">
                    <IconWrapper variant="default" size="md" className="mx-auto mb-3">
                      <Shield className="h-5 w-5" />
                    </IconWrapper>
                    <h3 className="font-medium text-gray-900 mb-1">Secure</h3>
                    <p className="text-sm text-gray-600">Enterprise-grade security</p>
                  </div>

                  <div className="text-center">
                    <IconWrapper variant="default" size="md" className="mx-auto mb-3">
                      <Database className="h-5 w-5" />
                    </IconWrapper>
                    <h3 className="font-medium text-gray-900 mb-1">Self-Hosted</h3>
                    <p className="text-sm text-gray-600">Complete data control</p>
                  </div>

                  <div className="text-center">
                    <IconWrapper variant="default" size="md" className="mx-auto mb-3">
                      <Brain className="h-5 w-5" />
                    </IconWrapper>
                    <h3 className="font-medium text-gray-900 mb-1">AI-Powered</h3>
                    <p className="text-sm text-gray-600">Intelligent automation</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Button
                    size="lg"
                    onClick={handleNext}
                    className="w-full group"
                  >
                    Start Setup
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    onClick={skipToDefaults}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Setting up...' : 'Use Defaults (Quick Start)'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Quick start uses: admin@dxlander.local / admin123456
                </p>
              </div>
            )}

            {/* Admin Account Step */}
            {step === 'admin' && (
              <div className="p-8">
                <div className="flex items-center mb-6">
                  <IconWrapper variant="primary" size="md" className="mr-4">
                    <User className="h-5 w-5" />
                  </IconWrapper>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Create Admin Account</h2>
                    <p className="text-gray-600">Setup your administrator credentials</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <FloatingInput
                      label="Email Address"
                      type="email"
                      value={config.adminEmail}
                      onChange={(e) => updateConfig('adminEmail', e.target.value)}
                    />
                    {errors.adminEmail && (
                      <p className="text-sm text-red-600 mt-1">{errors.adminEmail}</p>
                    )}
                  </div>

                  <div>
                    <FloatingInput
                      label="Password"
                      type="password"
                      value={config.adminPassword}
                      onChange={(e) => updateConfig('adminPassword', e.target.value)}
                    />
                    {errors.adminPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.adminPassword}</p>
                    )}
                  </div>

                  <div>
                    <FloatingInput
                      label="Confirm Password"
                      type="password"
                      value={config.confirmPassword}
                      onChange={(e) => updateConfig('confirmPassword', e.target.value)}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <div>
                    <FloatingInput
                      label="AI API Key (Optional)"
                      type="password"
                      value={config.aiApiKey}
                      onChange={(e) => updateConfig('aiApiKey', e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Claude or OpenAI API key. Can be configured later in settings.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="defaults"
                      checked={useDefaults}
                      onCheckedChange={(checked) => setUseDefaults(checked === true)}
                    />
                    <Label htmlFor="defaults" className="text-sm">
                      Use default settings (PostgreSQL, recommended configuration)
                    </Label>
                  </div>

                  {errors.general && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-900 mb-1">Setup Error</h4>
                          <p className="text-sm text-red-800">{errors.general}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-ocean-50 border border-ocean-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-ocean-600 mt-0.5 mr-3 shrink-0" />
                      <div>
                        <h4 className="font-medium text-ocean-900 mb-1">Default Configuration</h4>
                        <p className="text-sm text-ocean-800">
                          PostgreSQL database, Claude AI provider, and secure defaults will be used.
                          You can customize these later in settings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Step */}
            {step === 'complete' && (
              <div className="p-8 text-center">
                <IconWrapper variant="default" size="xl" className="mx-auto mb-6">
                  <CheckCircle2 className="h-8 w-8" />
                </IconWrapper>

                <h2 className="text-3xl font-bold mb-4 text-gray-900">
                  Setup Complete!
                </h2>

                <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
                  Your DXLander instance is ready. You can now create deployment workflows
                  and start automating your deployments.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <Card>
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-ocean-600" />
                        <span>Create your first project</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-ocean-600" />
                        <span>Set up deployment targets</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-ocean-600" />
                        <span>Configure AI settings</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Database:</span>
                        <span>PostgreSQL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">AI Provider:</span>
                        <span>Claude</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Port:</span>
                        <span>3000</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button
                  size="lg"
                  className="group"
                  onClick={() => router.push('/dashboard')}
                >
                  Open Dashboard
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            )}

            {/* Navigation Footer */}
            {(step === 'admin') && (
              <div className="flex items-center justify-between p-6 border-t border-ocean-200/30">
                <Button
                  variant="outline"
                  onClick={() => setStep('welcome')}
                >
                  Back
                </Button>

                <div className="flex items-center space-x-3">
                  {Object.keys(errors).length > 0 && (
                    <span className="text-sm text-red-600">
                      Please fix the errors above
                    </span>
                  )}

                  <Button
                    onClick={handleNext}
                    disabled={isLoading}
                    className="group"
                  >
                    {isLoading ? 'Creating Account...' : 'Complete Setup'}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Section>
    </PageLayout>
  )
}