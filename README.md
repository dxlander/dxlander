 <div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="documentation/assets/logos/logo-dark.jpg">
  <source media="(prefers-color-scheme: light)" srcset="documentation/assets/logos/logo.jpg">
  <img src="documentation/assets/logos/logo.jpg" alt="DXLander Logo" width="200" height="auto"/>
</picture>

# DXLander

**AI-Powered Zero-Configuration Deployment Platform**

Transform project deployment from hours of configuration to minutes of automation.

> ⚠️ **HEAVY DEVELOPMENT** - This project is in active development. Expect breaking changes, incomplete features, and evolving APIs. Contributions welcome but use in production at your own risk.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Development Status](https://img.shields.io/badge/Status-Heavy%20Development-red)](#current-status)

[Features](#key-features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## What is DXLander?

DXLander is a **self-hosted, open-source deployment automation platform** that uses AI to intelligently analyze your projects and generate deployment-ready configurations automatically.


- **Zero-Configuration Deployment**: Upload a project, get deployment-ready configs instantly
- **AI-Powered Discovery**: Automatically detects frameworks, dependencies, and integrations
- **Universal Project Support**: Works with any programming language and framework
- **Self-Hostable**: Full privacy and control
- **Built-in Security**: Encrypted credential storage, JWT authentication, role-based access

---

## Screenshots

### Project Import & Management
<div align="center">
<img src="documentation/assets/screenshots/project-import.png" alt="DXLander Project Import" width="800"/>
<p><em>Multiple import methods: GitHub, ZIP upload, GitLab, Bitbucket with drag-and-drop support</em></p>
</div>

### AI-Powered Project Discovery
<div align="center">
<img src="documentation/assets/screenshots/project-overview.png" alt="Project Analysis Overview" width="800"/>
<p><em>Intelligent framework detection and discovered features</em></p>
</div>

### Configuration Generation
<div align="center">
<img src="documentation/assets/screenshots/docker-configuration.png" alt="Docker Configuration Editor" width="800"/>
<p><em>Generated production-ready Docker configurations with multi-stage builds, syntax highlighting, and deployment recommendations</em></p>
</div>

---

## Key Features

### Project Import & Management
- **Multiple Import Methods**:
  - GitHub repositories (public & private with PAT)
  - ZIP file upload with drag & drop
  - GitLab/Bitbucket (coming soon)
- **Duplicate Detection**: SHA256 hashing prevents re-importing same project
- **Real-time Dashboard**: Status-based filtering, search, and organization

### AI-Powered Project Discovery
- **Framework Detection**: Next.js, React, Vue, Python, Go, and more
- **Dependency Analysis**: Reads package.json, requirements.txt, Cargo.toml, etc.
- **Environment Variable Detection**: Scans for required API keys and configurations
- **Build Command Inference**: Generates appropriate build and start commands
- **Real-time Progress Tracking**: Watch AI analyze your project in real-time

### Build Configuration Management
- **Multiple Configuration Types**:
  - Docker (single container deployments)
  - Docker Compose (multi-service applications)
  - Kubernetes (production-grade orchestration)
  - Bash scripts (deployment automation)
- **Configuration Editor**: Edit, version, and manage generated configs
- **Visual File Viewer**: Tabbed interface with syntax highlighting
- **Change Detection**: Track modifications with reset-to-original capability
- **Version History**: Track all configuration versions over time

### Integration & Security
- **Secure Credential Storage**: AES-256-GCM encrypted storage.
- **JWT Authentication**: Secure API access with token-based auth
- **Role-Based Access Control**: Admin and user roles
- **Per-User Encryption Keys**: Individual security per user account

---

## Technology Stack

### Frontend
- **Next.js 15** with App Router + **React 19**
- **TailwindCSS v4**
- **shadcn/ui** components (ocean-themed)
- **tRPC** for end-to-end type safety

### Backend
- **Hono** 
- **Node.js 18+** 
- **tRPC** 

### Infrastructure
- **Storage**: Local file system (`~/.dxlander/projects/`)
- **Package Manager**: pnpm workspaces

---

## Quick Start

### Prerequisites
- **Node.js 18+**
- **pnpm**

### Production Usage
```bash
# Run directly without installation
npx dxlander
```

### Development Setup

```bash
# 1. Clone repository
git clone https://github.com/dxlander/dxlander.git
cd dxlander

# 2. Install dependencies
pnpm install

# 3. Start development servers
pnpm dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# Database: ~/.dxlander/data/dxlander.db
```

### First-Time Setup

On first launch, you'll see the **Setup Wizard**:

1. **Welcome** - Introduction to DXLander
2. **Admin Account** - Create your first admin user
3. **Quick Start** - Click "Use Defaults" for instant setup:
   - Email: `admin@dxlander.local`
   - Password: `admin123456`
   - SQLite database configured
   - Ready in seconds!

---

## Available Scripts

### Development
```bash
pnpm dev              # Start both frontend and backend
pnpm dev:web          # Start only frontend (Next.js)
pnpm dev:api          # Start only backend (Hono)
```

### Building
```bash
pnpm build            # Build all packages and apps
pnpm build:web        # Build frontend only
pnpm build:api        # Build backend only
```

### Testing & Quality
```bash
pnpm lint             # Lint all code
pnpm lint:fix         # Auto-fix linting issues
pnpm typecheck        # TypeScript type checking
pnpm test             # Run tests
```

### CLI
```bash
node bin/dxlander.js  # Test CLI locally
```

---


### Quick Links
- [Setup Guide](#quick-start)
- [Architecture](#technology-stack)
- [Contributing](CONTRIBUTING.md)

---

## 🤝 Contributing

DXLander is open-source and welcomes contributions!

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

This means you can:
- Use commercially
- Modify
- Distribute
- Use privately
- Sublicense

---

## Supported Platforms & Integrations

### Import Sources (Current)
- **GitHub** (public & private repositories)
- **ZIP uploads** (drag & drop support)
- Coming Soon: **GitLab**
- Coming Soon: **Bitbucket**
- Coming Soon: **Git URL** (generic Git repositories)

### Deployment Platforms (Planned)
- **Vercel** - Serverless deployments
- **Railway** - Full-stack applications
- **Netlify** - Static sites & functions
- **Docker** - Local & remote containers
- **Fly.io** - Global edge deployments
- **Render** - Web services & databases
- **Others**

---

## Quick Commands Summary

```bash
# Try DXLander instantly
npx dxlander

# Development
pnpm install && pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

---

## Community & Support

### Get Help
- **Documentation**: Check `/documentation` folder
- **Discussions**: GitHub Discussions 
- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Issues

### Stay Updated
- **Star** the repository
- **Watch** for releases
- **Follow** for updates

---

## 🤝 Contributing

DXLander is open source and welcomes contributions! This project is in heavy development, so there are many opportunities to contribute.

### Ways to Contribute

- **Bug Reports**: Found an issue? Open a GitHub issue
- **Feature Requests**: Have an idea? Submit a GitHub issue with your suggestion
- **Documentation**: Help improve our docs
- **Testing**: Test the application and report issues
- **Code**: Submit pull requests for bug fixes or new features

### Development Status

Check the [Features Overview](documentation/FEATURES_OVERVIEW.md) for what's complete and what's in progress.

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/dxlander.git`
3. Follow the [development setup instructions](documentation/GETTING_STARTED.md)
4. Create a feature branch: `git checkout -b feature-name`
5. Make your changes and test thoroughly
6. Submit a pull request

### Code of Conduct

Please be respectful and constructive in all interactions

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

[Contributing](#-contributing) • [License](#-license)

</div>
