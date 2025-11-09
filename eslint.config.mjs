import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
    // Ignore patterns
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/out/**',
            '**/coverage/**',
            '**/.turbo/**',
            '**/dist-production/**',
            '**/*.d.ts',
            '**/next-env.d.ts',
            'apps/web/.next/**',
            'apps/api/dist/**',
            'packages/*/dist/**',
            '.claude/**',
            'CLAUDE.md',
        ],
    },    // Base JavaScript/TypeScript configuration
    {
        files: ['**/*.{js,mjs,cjs,ts,tsx}'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: false, // Disable project-based linting for faster checks
            },
            globals: {
                console: 'readonly',
                process: 'readonly',
                NodeJS: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                // Node.js and Web APIs
                URL: 'readonly',
                fetch: 'readonly',
                File: 'readonly',
                FormData: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                HeadersInit: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescript,
        },
        rules: {
            ...js.configs.recommended.rules,

            // Disable base rule in favor of @typescript-eslint version
            'no-unused-vars': 'off',

            // TypeScript-specific rules
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_|^React$',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',

            'no-console': 'off', // Allow console for now
            'no-debugger': 'error',
            'no-alert': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'error',
            'no-unused-expressions': 'error',
            'no-useless-concat': 'error',
            'no-useless-return': 'error',
            'no-undef': 'error',

            // Code style
            'quotes': ['error', 'double', { 'avoidEscape': true, 'allowTemplateLiterals': true }],

            // Import/Export rules
            'no-duplicate-imports': 'error',

            // Best practices
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-throw-literal': 'error',
            'prefer-template': 'warn',

            // Type Architecture Governance: Prevent duplicate domain type definitions
            // All domain types (Project, User, Deployment, etc.) must be imported from @dxlander/shared
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSInterfaceDeclaration[id.name=/^(Project|Deployment|User|Integration|DeploymentCredential|ConfigSet|ProviderTestResult|ProviderTestConfig|ProjectFile)$/]',
                    message: '❌ Do not redefine domain types. Import from @dxlander/shared instead. See type-architecture-refactoring.md for details.',
                },
                {
                    selector: 'TSTypeAliasDeclaration[id.name=/^(Project|Deployment|User|Integration|DeploymentCredential|ConfigSet|ProviderTestResult|ProviderTestConfig|ProjectFile)$/]',
                    message: '❌ Do not redefine domain types. Import from @dxlander/shared instead. See type-architecture-refactoring.md for details.',
                },
            ],
        },
    },

    // React/Next.js specific configuration for web app
    {
        files: ['apps/web/**/*.{ts,tsx}'],
        languageOptions: {
            globals: {
                React: 'readonly',
                JSX: 'readonly',
                // Browser APIs
                document: 'readonly',
                window: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                fetch: 'readonly',
                FormData: 'readonly',
                File: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                HeadersInit: 'readonly',
                HTMLElement: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLButtonElement: 'readonly',
                HTMLParagraphElement: 'readonly',
                HTMLHeadingElement: 'readonly',
                HTMLSpanElement: 'readonly',
                HTMLTableElement: 'readonly',
                HTMLTableSectionElement: 'readonly',
                HTMLTableRowElement: 'readonly',
                HTMLTableCellElement: 'readonly',
                HTMLTableCaptionElement: 'readonly',
                HTMLTextAreaElement: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                // Add console and process for Next.js
                console: 'readonly',
                process: 'readonly',
                NodeJS: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_|^React$', // Allow unused React import for JSX
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
        },
    },

    // Test files configuration
    {
        files: ['**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}', 'tests/**/*.{ts,tsx,js}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },

    // Configuration files
    {
        files: ['**/*.config.{js,mjs,ts}', '**/scripts/**/*.{js,mjs,ts}'],
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },

    // Prettier configuration (must be last)
    prettier,
];
