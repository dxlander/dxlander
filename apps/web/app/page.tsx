'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import {
  type LucideIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  User,
  Brain,
  Eye,
  Rocket,
  AlertCircle,
} from 'lucide-react';

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

export default function SetupPage() {
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
        document.cookie = `dxlander-token=${data.token}; path=/; max-age=604800; SameSite=Strict`;
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
        } else if (trimmedPath.includes('..')) {
          newErrors.dbPath = 'Path traversal detected. Please provide a valid path.';
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
    } catch (error) {
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
      await setupMutation.mutateAsync({
        adminEmail: formData.adminEmail.trim(),
        adminPassword: formData.adminPassword,
        confirmPassword: formData.adminConfirmPassword,
        aiApiKey: formData.aiEnabled ? formData.aiApiKey || undefined : undefined,
        useDefaults: false,
      });
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

  const renderStepContent = (): React.ReactNode => {
    switch (currentStep) {
      case 0:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome to DXLander!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Let&apos;s get your instance set up in just a few steps. You&apos;ll configure your
              database, create an admin account, and optionally set up AI features.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Start Setup
              </button>
              <button
                onClick={handleUseDefaults}
                disabled={loading}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Use Defaults (Quick Start)'}
              </button>
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
                  <button
                    onClick={() => handleChange('dbType', 'sqlite')}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      formData.dbType === 'sqlite'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">SQLite</div>
                    <div className="text-sm text-gray-600">Recommended for most users</div>
                  </button>
                  <button
                    onClick={() => handleChange('dbType', 'postgresql')}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      formData.dbType === 'postgresql'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">PostgreSQL</div>
                    <div className="text-sm text-gray-600">For production deployments</div>
                  </button>
                </div>
              </div>

              {formData.dbType === 'sqlite' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database Path
                  </label>
                  <input
                    type="text"
                    value={formData.dbPath}
                    onChange={(e) => handleChange('dbPath', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      errors.dbPath ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="./dxlander.db"
                  />
                  {errors.dbPath && <p className="text-xs text-red-600 mt-1">{errors.dbPath}</p>}
                  <p className="text-xs text-gray-500 mt-1">Local file path for SQLite database</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                      <input
                        type="text"
                        value={formData.pgHost}
                        onChange={(e) => handleChange('pgHost', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.pgHost ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="localhost"
                      />
                      {errors.pgHost && (
                        <p className="text-xs text-red-600 mt-1">{errors.pgHost}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        step="1"
                        value={formData.pgPort}
                        onChange={(e) => handleChange('pgPort', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.pgPort ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="5432"
                      />
                      {errors.pgPort && (
                        <p className="text-xs text-red-600 mt-1">{errors.pgPort}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database Name
                    </label>
                    <input
                      type="text"
                      value={formData.pgDatabase}
                      onChange={(e) => handleChange('pgDatabase', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.pgDatabase ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="dxlander"
                    />
                    {errors.pgDatabase && (
                      <p className="text-xs text-red-600 mt-1">{errors.pgDatabase}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.pgUser}
                      onChange={(e) => handleChange('pgUser', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.pgUser ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="postgres"
                    />
                    {errors.pgUser && <p className="text-xs text-red-600 mt-1">{errors.pgUser}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={formData.pgPassword}
                      onChange={(e) => handleChange('pgPassword', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.pgPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="••••••••"
                    />
                    {errors.pgPassword && (
                      <p className="text-xs text-red-600 mt-1">{errors.pgPassword}</p>
                    )}
                  </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => handleChange('adminEmail', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.adminEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="admin@example.com"
                />
                {errors.adminEmail && (
                  <p className="text-xs text-red-600 mt-1">{errors.adminEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => handleChange('adminPassword', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.adminPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                {errors.adminPassword && (
                  <p className="text-xs text-red-600 mt-1">{errors.adminPassword}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={formData.adminConfirmPassword}
                  onChange={(e) => handleChange('adminConfirmPassword', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.adminConfirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                />
                {errors.adminConfirmPassword && (
                  <p className="text-xs text-red-600 mt-1">{errors.adminConfirmPassword}</p>
                )}
              </div>
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
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="aiEnabled"
                  checked={formData.aiEnabled}
                  onChange={(e) => handleChange('aiEnabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="aiEnabled" className="ml-2 text-sm font-medium text-gray-700">
                  Enable AI Features
                </label>
              </div>

              {formData.aiEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Provider
                    </label>
                    <select
                      value={formData.aiProvider}
                      onChange={(e) => handleChange('aiProvider', e.target.value as AIProvider)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Google (Gemini)</option>
                      <option value="azure">Azure OpenAI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input
                      type="password"
                      value={formData.aiApiKey}
                      onChange={(e) => handleChange('aiApiKey', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.aiApiKey ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="sk-..."
                    />
                    {errors.aiApiKey && (
                      <p className="text-xs text-red-600 mt-1">{errors.aiApiKey}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Your API key will be stored securely and never shared
                    </p>
                  </div>
                </>
              )}

              {!formData.aiEnabled && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    You can skip AI configuration for now and enable it later from settings.
                  </p>
                </div>
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
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Database
                </h3>
                <div className="space-y-1 text-sm">
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
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                >
                  Edit Database Settings
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Admin Account
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{formData.adminEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Password:</span>
                    <span className="font-medium">••••••••</span>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                >
                  Edit Admin Account
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  AI Configuration
                </h3>
                {formData.aiEnabled ? (
                  <div className="space-y-1 text-sm">
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
                <button
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-2"
                >
                  Edit AI Configuration
                </button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 text-sm">Ready to Complete Setup</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Once you click &quot;Complete Setup&quot;, your DXLander instance will be
                    initialized with these settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Setup Complete! 🎉</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Your DXLander instance has been successfully configured and is ready to use.
            </p>
            <div className="space-y-3 pt-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full max-w-xs mx-auto block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Go to Dashboard
              </button>
              <a href="/docs" className="block text-sm text-blue-600 hover:text-blue-700">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {currentStep < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.slice(0, -1).map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === index;
                const isCompleted = currentStep > index;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div
                        role="img"
                        aria-label={`Step ${index + 1}: ${step.title}${
                          isCompleted ? ' - Completed' : isActive ? ' - Current' : ' - Upcoming'
                        }`}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white scale-110'
                            : isCompleted
                              ? 'bg-green-500 text-white'
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
                            ? 'text-blue-600'
                            : isCompleted
                              ? 'text-green-600'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 2 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-all ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {renderStepContent()}

          {errors.submit && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {currentStep > 0 && currentStep < 5 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition"
                disabled={loading}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50"
                  disabled={loading}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition disabled:opacity-50"
                >
                  {loading ? 'Completing...' : 'Complete Setup'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
