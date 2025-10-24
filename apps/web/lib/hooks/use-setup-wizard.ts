"use client"

import { useState, useCallback, useMemo } from 'react'
import { SetupConfig, SetupConfigSchema } from '@dxlander/shared'
import { z } from 'zod'

export interface UseSetupWizardProps {
  initialConfig?: Partial<SetupConfig>
  onStepComplete?: (step: number, data: Partial<SetupConfig>) => void
  onSetupComplete?: (config: SetupConfig) => void
}

export function useSetupWizard({
  initialConfig = {},
  onStepComplete,
  onSetupComplete
}: UseSetupWizardProps = {}) {
  // Setup wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Configuration state with defaults
  const [config, setConfig] = useState<Partial<SetupConfig>>({
    // Auth step defaults
    instanceName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',

    // Database step defaults
    dbType: 'sqlite',
    dbPath: './data/dxlander.db',
    dbHost: '',
    dbPort: '',
    dbName: '',
    dbUser: '',
    dbPassword: '',

    // AI step defaults
    aiProvider: 'claude',
    aiApiKey: '',
    aiModel: '',
    enableLocalAI: false,

    // Advanced step defaults
    serverPort: '3000',
    encryptionKey: '',
    logLevel: 'info',
    enableTelemetry: true,
    enableHttps: false,
    customDomain: '',

    ...initialConfig
  })

  // Update configuration field
  const updateConfig = useCallback((key: keyof SetupConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))

    // Clear related errors when field is updated
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[key]
        return newErrors
      })
    }
  }, [errors])

  // Validation schemas for each step
  const stepValidationSchemas = useMemo(() => ({
    auth: z.object({
      instanceName: z.string().min(1, 'Instance name is required'),
      adminEmail: z.string().email('Valid email is required'),
      adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string()
    }).refine((data) => data.adminPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"]
    }),

    database: z.object({
      dbType: z.enum(['sqlite', 'postgresql', 'mysql']),
      dbPath: z.string().optional(),
      dbHost: z.string().optional(),
      dbPort: z.string().optional(),
      dbName: z.string().optional(),
      dbUser: z.string().optional(),
      dbPassword: z.string().optional()
    }).refine((data) => {
      if (data.dbType === 'sqlite') {
        return data.dbPath && data.dbPath.length > 0
      }
      if (data.dbType === 'postgresql' || data.dbType === 'mysql') {
        return data.dbHost && data.dbPort && data.dbName && data.dbUser
      }
      return true
    }, {
      message: "Database configuration is incomplete",
      path: ["dbHost"]
    }),

    ai: z.object({
      aiProvider: z.enum(['claude', 'openai', 'local']),
      aiApiKey: z.string().optional(),
      aiModel: z.string().optional(),
      enableLocalAI: z.boolean().optional()
    }).refine((data) => {
      if ((data.aiProvider === 'claude' || data.aiProvider === 'openai') && !data.aiApiKey) {
        return false
      }
      return true
    }, {
      message: "API key is required for this provider",
      path: ["aiApiKey"]
    }),

    advanced: z.object({
      serverPort: z.string().refine((port) => {
        const num = parseInt(port)
        return !isNaN(num) && num > 0 && num < 65536
      }, 'Port must be between 1 and 65535'),
      encryptionKey: z.string().optional(),
      logLevel: z.enum(['error', 'warn', 'info', 'debug']),
      enableTelemetry: z.boolean(),
      enableHttps: z.boolean(),
      customDomain: z.string().optional()
    })
  }), [])

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const stepNames = ['welcome', 'auth', 'database', 'ai', 'advanced', 'complete']
    const currentStepName = stepNames[currentStep] as keyof typeof stepValidationSchemas

    if (!stepValidationSchemas[currentStepName]) {
      return { isValid: true, errors: {} }
    }

    const result = stepValidationSchemas[currentStepName].safeParse(config)

    if (result.success) {
      return { isValid: true, errors: {} }
    }

    const stepErrors: Record<string, string> = {}
    result.error.errors.forEach(err => {
      if (err.path[0]) {
        stepErrors[err.path[0] as string] = err.message
      }
    })

    return { isValid: false, errors: stepErrors }
  }, [currentStep, config, stepValidationSchemas])

  // Navigate to next step
  const nextStep = useCallback(() => {
    const validation = validateCurrentStep()

    if (!validation.isValid) {
      setErrors(validation.errors)
      return false
    }

    if (currentStep < 5) { // 6 total steps (0-5)
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      setErrors({})

      // Call step complete callback
      onStepComplete?.(currentStep, config)

      return true
    }

    return false
  }, [currentStep, validateCurrentStep, onStepComplete, config])

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setErrors({})
      return true
    }
    return false
  }, [currentStep])

  // Jump to specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 5) {
      setCurrentStep(step)
      setErrors({})
      return true
    }
    return false
  }, [])

  // Complete setup
  const completeSetup = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrors({})

      // Validate complete configuration
      const validatedConfig = SetupConfigSchema.parse(config)

      // Call completion callback
      onSetupComplete?.(validatedConfig)

      return { success: true, config: validatedConfig }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            validationErrors[err.path[0] as string] = err.message
          }
        })
        setErrors(validationErrors)
        return { success: false, errors: validationErrors }
      }

      throw error
    } finally {
      setIsLoading(false)
    }
  }, [config, onSetupComplete])

  // Reset wizard to initial state
  const resetWizard = useCallback(() => {
    setCurrentStep(0)
    setConfig(initialConfig)
    setErrors({})
    setIsLoading(false)
  }, [initialConfig])

  // Calculate progress percentage
  const progress = useMemo(() => ((currentStep + 1) / 6) * 100, [currentStep])

  // Check if current step is valid
  const isCurrentStepValid = useMemo(() => {
    const validation = validateCurrentStep()
    return validation.isValid
  }, [validateCurrentStep])

  return {
    // State
    currentStep,
    config,
    errors,
    isLoading,
    progress,
    isCurrentStepValid,

    // Actions
    updateConfig,
    nextStep,
    prevStep,
    goToStep,
    completeSetup,
    resetWizard,
    validateCurrentStep,

    // Helpers
    canGoNext: isCurrentStepValid && currentStep < 5,
    canGoPrev: currentStep > 0,
    isLastStep: currentStep === 5,
    stepNames: ['welcome', 'auth', 'database', 'ai', 'advanced', 'complete'] as const
  }
}