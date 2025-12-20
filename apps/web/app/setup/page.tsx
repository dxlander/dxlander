'use client';

import { Fragment, Suspense, type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type LucideIcon,
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  Rocket,
  User,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { FloatingInput } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DatabaseType = 'sqlite' | 'postgresql';
type AIProvider = 'openai' | 'anthropic' | 'google' | 'azure';

type FormState = {
  dbType: DatabaseType;
  dbPath: string;
  pgHost: string;
  pgPort: string;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  adminEmail: string;
  adminPassword: string;
  adminConfirmPassword: string;
  aiEnabled: boolean;
  aiProvider: AIProvider;
  aiApiKey: string;
};

type FormField = keyof FormState;
type FormErrors = Partial<Record<FormField | 'submit', string>>;

type StepConfig = {
  id: number;
  title: string;
  icon: LucideIcon;
};

function SetupPageContent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [formData, setFormData] = useState<FormState>({
    dbType: 'sqlite',
    dbPath: './dxlander.db',
    pgHost: 'localhost',
    pgPort: '5432',
    pgDatabase: 'dxlander',
    pgUser: 'postgres',
    pgPassword: '',
    adminEmail: '',
    adminPassword: '',
    adminConfirmPassword: '',
    aiEnabled: false,
    aiProvider: 'openai',
    aiApiKey: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const clearSubmitError = (): void => {
    setErrors((prev) => {
      if (!prev.submit) return prev;
      const { submit: _submit, ...rest } = prev;
      return rest as FormErrors;
    });
  };

  const clearSensitiveFields = (): void => {
    setFormData((prev) => ({
      ...prev,
      pgPassword: '',
      adminPassword: '',
      adminConfirmPassword: '',
      aiApiKey: '',
    }));
  };

  const setupMutation = trpc.setup.completeSetup.useMutation({
    onSuccess: (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('dxlander-token', data.token);
        const isSecure = window.location.protocol === 'https:';
        const secureFlag = isSecure ? '; Secure' : '';
        document.cookie = `dxlander-token=${data.token}; path=/; max-age=604800; SameSite=Strict${secureFlag}`;
      }
      clearSensitiveFields();
      clearSubmitError();
      setCurrentStep(5);
    },
    onError: (error) => {
      setErrors((prev) => ({ ...prev, submit: error.message }));
    },
  });

  const steps: StepConfig[] = [
    { id: 0, title: 'Welcome', icon: Rocket },
    { id: 1, title: 'Database', icon: Database },
    { id: 2, title: 'Admin Account', icon: User },
    { id: 3, title: 'AI Configuration', icon: Brain },
    { id: 4, title: 'Review', icon: Eye },
    { id: 5, title: 'Complete', icon: CheckCircle2 },
  ];

  const handleChange = <K extends FormField>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }) as FormState);
    if (errors[field]) {
      const { [field]: _removed, ...rest } = errors;
      setErrors(rest as FormErrors);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (formData.dbType === 'postgresql') {
        if (!formData.pgHost) newErrors.pgHost = 'Host is required';
        if (!formData.pgPort) {
          newErrors.pgPort = 'Port is required';
        } else {
          const parsedPort = parseInt(formData.pgPort, 10);
          if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
            newErrors.pgPort = 'Port must be a number between 1 and 65535';
          }
        }
        if (!formData.pgDatabase) newErrors.pgDatabase = 'Database name is required';
        if (!formData.pgUser) newErrors.pgUser = 'Username is required';
        if (!formData.pgPassword) newErrors.pgPassword = 'Password is required';
      } else if (formData.dbType === 'sqlite') {
        const trimmedPath = formData.dbPath.trim();
        if (!trimmedPath) {
          newErrors.dbPath = 'Database path is required';
        } else if (
          trimmedPath.includes('..') ||
          trimmedPath.includes('~') ||
          trimmedPath.match(/[<>:"|?*]/)
        ) {
          newErrors.dbPath =
            'Invalid database path. Avoid path traversal patterns and special characters.';
        }
      }
    }

    if (step === 2) {
      if (!formData.adminEmail) {
        newErrors.adminEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
        newErrors.adminEmail = 'Invalid email format';
      }
      if (!formData.adminPassword) {
        newErrors.adminPassword = 'Password is required';
      } else if (formData.adminPassword.length < 8) {
        newErrors.adminPassword = 'Password must be at least 8 characters';
      } else if (formData.adminPassword !== formData.adminConfirmPassword) {
        newErrors.adminConfirmPassword = 'Passwords do not match';
      }
      if (!formData.adminConfirmPassword) {
        newErrors.adminConfirmPassword = 'Please confirm your password';
      }
    }

    if (step === 3 && formData.aiEnabled) {
      if (!formData.aiApiKey) {
        newErrors.aiApiKey = 'API key is required when AI is enabled';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleUseDefaults = async (): Promise<void> => {
    clearSubmitError();
    setLoading(true);
    try {
      await setupMutation.mutateAsync({
        adminEmail: 'admin@dxlander.local',
        adminPassword: 'admin123456',
        confirmPassword: 'admin123456',
        useDefaults: true,
      });
    } catch (_error) {
      // Error handled in mutation onError
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!validateStep(currentStep)) return;
    clearSubmitError();
    setLoading(true);
    try {
      const payload: {
        adminEmail: string;
        adminPassword: string;
        confirmPassword: string;
        useDefaults: boolean;
        dbType?: string;
        sqlitePath?: string;
        postgresHost?: string;
        postgresPort?: number;
        postgresDb?: string;
        postgresUser?: string;
        postgresPassword?: string;
        aiEnabled?: boolean;
        aiProvider?: string;
        aiApiKey?: string;
      } = {
        adminEmail: formData.adminEmail.trim(),
        adminPassword: formData.adminPassword,
        confirmPassword: formData.adminConfirmPassword,
        useDefaults: false,
      };

      payload.dbType = formData.dbType;
      if (formData.dbType === 'sqlite') {
        payload.sqlitePath = formData.dbPath;
      } else if (formData.dbType === 'postgresql') {
        payload.postgresHost = formData.pgHost;
        payload.postgresPort = parseInt(formData.pgPort, 10);
        payload.postgresDb = formData.pgDatabase;
        payload.postgresUser = formData.pgUser;
        payload.postgresPassword = formData.pgPassword;
      }

      payload.aiEnabled = formData.aiEnabled;
      if (formData.aiEnabled) {
        payload.aiProvider = formData.aiProvider;
        payload.aiApiKey = formData.aiApiKey || undefined;
      }

      await setupMutation.mutateAsync(payload);
    } catch (error) {
      if (error instanceof Error) {
        setErrors((prev) => ({ ...prev, submit: error.message }));
      } else {
        setErrors((prev) => ({ ...prev, submit: 'Setup failed. Please try again.' }));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (): ReactNode => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-ocean-600 to-ocean-500 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-ocean-500/30">
              <img src="/logo-white.svg" alt="DXLander Logo" className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome to DXLander!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Let&apos;s get your instance set up in just a few steps. You&apos;ll configure your
              database, create an admin account, and optionally set up AI features.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button size="lg" onClick={handleNext}>
                Start Setup
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" onClick={handleUseDefaults} disabled={loading}>
                {loading ? 'Setting up...' : 'Use Defaults (Quick Start)'}
              </Button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Database Configuration</h2>
              <p className="text-gray-600">
                Choose your database type and provide connection details.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Database Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Card
                    variant={formData.dbType === 'sqlite' ? 'elevated' : 'default'}
                    className="cursor-pointer transition-all"
                    onClick={() => handleChange('dbType', 'sqlite')}
                  >
                    <CardContent className="p-4">
                      <div className="font-semibold text-gray-900">SQLite</div>
                      <div className="text-sm text-gray-600">Recommended for most users</div>
                    </CardContent>
                  </Card>
                  <Card
                    variant={formData.dbType === 'postgresql' ? 'elevated' : 'default'}
                    className="cursor-pointer transition-all"
                    onClick={() => handleChange('dbType', 'postgresql')}
                  >
                    <CardContent className="p-4">
                      <div className="font-semibold text-gray-900">PostgreSQL</div>
                      <div className="text-sm text-gray-600">For production deployments</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {formData.dbType === 'sqlite' ? (
                <FloatingInput
                  label="Database Path"
                  type="text"
                  value={formData.dbPath}
                  onChange={(e) => handleChange('dbPath', e.target.value)}
                  error={errors.dbPath}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingInput
                      label="Host"
                      type="text"
                      value={formData.pgHost}
                      onChange={(e) => handleChange('pgHost', e.target.value)}
                      error={errors.pgHost}
                    />
                    <FloatingInput
                      label="Port"
                      type="number"
                      value={formData.pgPort}
                      onChange={(e) => handleChange('pgPort', e.target.value)}
                      error={errors.pgPort}
                    />
                  </div>
                  <FloatingInput
                    label="Database Name"
                    type="text"
                    value={formData.pgDatabase}
                    onChange={(e) => handleChange('pgDatabase', e.target.value)}
                    error={errors.pgDatabase}
                  />
                  <FloatingInput
                    label="Username"
                    type="text"
                    value={formData.pgUser}
                    onChange={(e) => handleChange('pgUser', e.target.value)}
                    error={errors.pgUser}
                  />
                  <FloatingInput
                    label="Password"
                    type="password"
                    value={formData.pgPassword}
                    onChange={(e) => handleChange('pgPassword', e.target.value)}
                    error={errors.pgPassword}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Account</h2>
              <p className="text-gray-600">Create your administrator account to manage DXLander.</p>
            </div>

            <div className="space-y-4">
              <FloatingInput
                label="Email Address"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => handleChange('adminEmail', e.target.value)}
                error={errors.adminEmail}
              />
              <FloatingInput
                label="Password"
                type="password"
                value={formData.adminPassword}
                onChange={(e) => handleChange('adminPassword', e.target.value)}
                error={errors.adminPassword}
              />
              <FloatingInput
                label="Confirm Password"
                type="password"
                value={formData.adminConfirmPassword}
                onChange={(e) => handleChange('adminConfirmPassword', e.target.value)}
                error={errors.adminConfirmPassword}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Configuration</h2>
              <p className="text-gray-600">
                Optionally configure AI features for enhanced functionality.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="aiEnabled"
                  checked={formData.aiEnabled}
                  onCheckedChange={(checked) => handleChange('aiEnabled', checked as boolean)}
                />
                <label
                  htmlFor="aiEnabled"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable AI Features
                </label>
              </div>

              {formData.aiEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Provider
                    </label>
                    <Select
                      value={formData.aiProvider}
                      onValueChange={(value) => handleChange('aiProvider', value as AIProvider)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (GPT-4, GPT-3.5)</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                        <SelectItem value="google">Google (Gemini)</SelectItem>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <FloatingInput
                    label="API Key"
                    type="password"
                    value={formData.aiApiKey}
                    onChange={(e) => handleChange('aiApiKey', e.target.value)}
                    error={errors.aiApiKey}
                  />
                </>
              )}

              {!formData.aiEnabled && (
                <Card variant="default" className="bg-ocean-50/30">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">
                      You can skip AI configuration for now and enable it later from settings.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Confirm</h2>
              <p className="text-gray-600">
                Please review your configuration before completing setup.
              </p>
            </div>

            <div className="space-y-4">
              <Card variant="default">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-ocean-600" />
                    Database
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{formData.dbType.toUpperCase()}</span>
                    </div>
                    {formData.dbType === 'sqlite' ? (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Path:</span>
                        <span className="font-medium">{formData.dbPath}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Host:</span>
                          <span className="font-medium">
                            {formData.pgHost}:{formData.pgPort}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Database:</span>
                          <span className="font-medium">{formData.pgDatabase}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                    className="mt-3 text-xs"
                  >
                    Edit Database Settings
                  </Button>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-ocean-600" />
                    Admin Account
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{formData.adminEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Password:</span>
                      <span className="font-medium">••••••••</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(2)}
                    className="mt-3 text-xs"
                  >
                    Edit Admin Account
                  </Button>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-ocean-600" />
                    AI Configuration
                  </h3>
                  {formData.aiEnabled ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Provider:</span>
                        <span className="font-medium capitalize">{formData.aiProvider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">API Key:</span>
                        <span className="font-medium">••••••••</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">AI features disabled</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(3)}
                    className="mt-3 text-xs"
                  >
                    Edit AI Configuration
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card variant="default" className="bg-ocean-50/40 border-ocean-300/50">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-ocean-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-ocean-900 text-sm">
                      Ready to Complete Setup
                    </h4>
                    <p className="text-sm text-ocean-700 mt-1">
                      Once you click &quot;Complete Setup&quot;, your DXLander instance will be
                      initialized with these settings.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-ocean-100 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-ocean-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Setup Complete!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Your DXLander instance has been successfully configured and is ready to use.
            </p>
            <div className="space-y-3 pt-4">
              <Button
                size="lg"
                onClick={() => router.push('/dashboard')}
                className="w-full max-w-xs"
              >
                Go to Dashboard
              </Button>
              <a href="/docs" className="block text-sm text-ocean-600 hover:text-ocean-700">
                View Documentation →
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-50 via-white to-ocean-100/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {currentStep < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.slice(0, -1).map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === index;
                const isCompleted = currentStep > index;

                return (
                  <Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div
                        role="img"
                        aria-label={`Step ${index + 1}: ${step.title}${
                          isCompleted ? ' - Completed' : isActive ? ' - Current' : ' - Upcoming'
                        }`}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-ocean-600 text-white scale-110 shadow-lg shadow-ocean-500/30'
                            : isCompleted
                              ? 'bg-ocean-500 text-white shadow-md shadow-ocean-500/20'
                              : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`text-xs mt-2 font-medium hidden sm:block ${
                          isActive
                            ? 'text-ocean-600'
                            : isCompleted
                              ? 'text-ocean-500'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 2 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-all ${
                          isCompleted ? 'bg-ocean-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        )}

        <Card variant="default" className="shadow-2xl">
          <CardContent className="p-8">
            {renderStepContent()}

            {errors.submit && (
              <Card variant="default" className="mt-6 border-red-200 bg-red-50">
                <CardContent className="p-4 text-sm text-red-700">{errors.submit}</CardContent>
              </Card>
            )}

            {currentStep > 0 && currentStep < 5 && (
              <div className="flex justify-between mt-8 pt-6 border-t border-ocean-200/50">
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>

                {currentStep < 4 ? (
                  <Button onClick={handleNext} disabled={loading}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={loading}
                    className="bg-gradient-to-r from-ocean-600 to-ocean-500"
                  >
                    {loading ? 'Completing...' : 'Complete Setup'}
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupPageContent />
    </Suspense>
  );
}
