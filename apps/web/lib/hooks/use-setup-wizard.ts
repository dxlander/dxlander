'use client';

import { useState, useCallback, useMemo } from 'react';
import { SetupConfig, SetupConfigSchema } from '@dxlander/shared';
import { z } from 'zod';

export interface UseSetupWizardProps {
  initialConfig?: Partial<SetupConfig>;
  onStepComplete?: (step: number, data: Partial<SetupConfig>) => void;
  onSetupComplete?: (config: SetupConfig) => void;
}

export function useSetupWizard({
  initialConfig = {},
  onStepComplete,
  onSetupComplete,
}: UseSetupWizardProps = {}) {
  // Setup wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Configuration state with defaults
  const [config, setConfig] = useState<Partial<SetupConfig>>({
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    aiApiKey: '',
    useDefaults: true,
    ...initialConfig,
  });

  // Update configuration field
  const updateConfig = useCallback(
    (key: keyof SetupConfig, value: any) => {
      setConfig((prev) => ({ ...prev, [key]: value }));

      // Clear related errors when field is updated
      if (errors[key]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[key];
          return newErrors;
        });
      }
    },
    [errors]
  );

  // Validation schemas for each step
  const stepValidationSchemas = useMemo(
    () => ({
      auth: z
        .object({
          adminEmail: z.string().email('Valid email is required'),
          adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
          confirmPassword: z.string(),
        })
        .refine((data) => data.adminPassword === data.confirmPassword, {
          message: "Passwords don't match",
          path: ['confirmPassword'],
        }),

      ai: z.object({
        aiApiKey: z.string().optional(),
        useDefaults: z.boolean().optional(),
      }),
    }),
    []
  );

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const stepNames = ['welcome', 'auth', 'ai', 'complete'];
    const currentStepName = stepNames[currentStep] as keyof typeof stepValidationSchemas;

    if (!stepValidationSchemas[currentStepName]) {
      return { isValid: true, errors: {} };
    }

    const result = stepValidationSchemas[currentStepName].safeParse(config);

    if (result.success) {
      return { isValid: true, errors: {} };
    }

    const stepErrors: Record<string, string> = {};
    result.error.errors.forEach((err) => {
      if (err.path[0]) {
        stepErrors[err.path[0] as string] = err.message;
      }
    });

    return { isValid: false, errors: stepErrors };
  }, [currentStep, config, stepValidationSchemas]);

  // Navigate to next step
  const nextStep = useCallback(() => {
    const validation = validateCurrentStep();

    if (!validation.isValid) {
      setErrors(validation.errors);
      return false;
    }

    if (currentStep < 3) {
      // 4 total steps (0-3)
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setErrors({});

      // Call step complete callback
      onStepComplete?.(currentStep, config);

      return true;
    }

    return false;
  }, [currentStep, validateCurrentStep, onStepComplete, config]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
      return true;
    }
    return false;
  }, [currentStep]);

  // Jump to specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 3) {
      setCurrentStep(step);
      setErrors({});
      return true;
    }
    return false;
  }, []);

  // Complete setup
  const completeSetup = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrors({});

      // Validate complete configuration
      const validatedConfig = SetupConfigSchema.parse(config);

      // Call completion callback
      onSetupComplete?.(validatedConfig);

      return { success: true, config: validatedConfig };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            validationErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(validationErrors);
        return { success: false, errors: validationErrors };
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, onSetupComplete]);

  // Reset wizard to initial state
  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setConfig(initialConfig);
    setErrors({});
    setIsLoading(false);
  }, [initialConfig]);

  // Calculate progress percentage
  const progress = useMemo(() => ((currentStep + 1) / 4) * 100, [currentStep]);

  // Check if current step is valid
  const isCurrentStepValid = useMemo(() => {
    const validation = validateCurrentStep();
    return validation.isValid;
  }, [validateCurrentStep]);

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
    canGoNext: isCurrentStepValid && currentStep < 3,
    canGoPrev: currentStep > 0,
    isLastStep: currentStep === 3,
    stepNames: ['welcome', 'auth', 'ai', 'complete'] as const,
  };
}
