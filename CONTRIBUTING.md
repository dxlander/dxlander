# Contributing to DXLander

Thank you for your interest in contributing to DXLander! We welcome contributions from everyone.

## Quick Reference

### Essential Commands

```bash
# Development
pnpm dev              # Start dev servers
pnpm build            # Build everything

# Code Quality (run before committing)
pnpm lint             # Check for issues
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format all files
pnpm format:check     # Check formatting
pnpm typecheck        # Type checking
pnpm test             # Run tests

# Quick check everything
pnpm lint:fix && pnpm format && pnpm typecheck && pnpm test && pnpm build
```

## ⚠️ Development Status

DXLander is currently in **heavy development**. This means:

- APIs and interfaces may change frequently
- Features may be incomplete or unstable
- Breaking changes are expected
- Use in production at your own risk

## Ways to Contribute

### 🐛 Bug Reports

Found a bug? Please open an issue with:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots if applicable

### 💡 Feature Requests

Have an idea? We'd love to hear it! Please:

- Check existing issues to avoid duplicates
- Provide clear use case and rationale
- Include mockups or examples if helpful

### 📖 Documentation

Help improve our documentation:

- Fix typos or unclear instructions
- Add examples and use cases
- Improve API documentation
- Create tutorials or guides

### 💻 Code Contributions

#### Development Setup

1. **Prerequisites**
   - Node.js 18+
   - pnpm 8+
   - Git

2. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/dxlander.git
   cd dxlander
   ```

3. **Install Dependencies**

   ```bash
   pnpm install
   ```

4. **Start Development**
   ```bash
   pnpm dev
   ```

For detailed setup instructions, see [documentation/GETTING_STARTED.md](./documentation/GETTING_STARTED.md).

#### Understanding the Project

Before contributing, familiarize yourself with:

- **[Project Architecture](./documentation/PROJECT_ARCHITECTURE.md)** - Technical structure and design
- **[Features Overview](./documentation/FEATURES_OVERVIEW.md)** - What's built and what's planned
- **[Getting Started Guide](./documentation/GETTING_STARTED.md)** - Development workflow

#### Project Structure

```
dxlander/
├── apps/
│   ├── api/          # Backend API (Hono)
│   └── web/          # Frontend (Next.js)
├── packages/
│   ├── shared/       # Shared utilities
│   ├── database/     # Database layer
│   ├── ai-agents/    # AI integration
│   └── ...
├── bin/              # CLI entry point
└── tests/            # Test suites
```

#### Development Guidelines

- **TypeScript**: All code should be written in TypeScript
- **Code Style**: We use Prettier and ESLint (run `pnpm lint:fix`)
- **Code Formatting**: Run `pnpm format` to format all files
- **Testing**: Add tests for new features
- **Commits**: Use clear, descriptive commit messages
- **PRs**: Keep them focused and include clear descriptions
- **No Unused Code**: Remove unused variables, imports, and dead code before committing

#### Code Quality Checks

Before submitting a PR, ensure all quality checks pass:

```bash
# Run all checks at once
pnpm lint          # ESLint checking
pnpm format:check  # Prettier formatting check
pnpm typecheck     # TypeScript type checking
pnpm test          # Run test suites
pnpm build         # Ensure build succeeds

# Auto-fix issues
pnpm lint:fix      # Auto-fix ESLint issues
pnpm format        # Auto-format with Prettier
```

#### Pre-commit Hooks

We use **Husky** and **lint-staged** to automatically check your code before commits:

- ESLint will check for code issues
- Prettier will format your code
- TypeScript will check for type errors

These run automatically on `git commit`. If checks fail, the commit will be blocked until you fix the issues.

#### Pull Request Process

1. Create a feature branch: `git checkout -b feature-name`
2. Make your changes
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint:fix`
5. Run formatting: `pnpm format`
6. Run type checking: `pnpm typecheck`
7. Ensure build succeeds: `pnpm build`
8. Commit your changes (pre-commit hooks will run automatically)
9. Push to your fork
10. Open a pull request using the PR template

#### PR Requirements

All PRs must pass automated checks before merging:

- ✅ **Linting** - No ESLint errors or warnings
- ✅ **Formatting** - Code formatted with Prettier
- ✅ **Type Checking** - No TypeScript errors
- ✅ **Build** - Project builds successfully
- ✅ **Tests** - All tests pass
- ✅ **No Unused Code** - No unused variables or imports

Our CI/CD pipeline automatically runs these checks on every PR. You can see the status in the PR page.

#### PR Template

When you open a PR, you'll see a template that includes:

- **Description** - What your PR does
- **Type of Change** - Bug fix, feature, breaking change, etc.
- **Changes Made** - Specific list of changes
- **Testing** - How you tested your changes
- **Checklist** - Code quality, documentation, and security checks

Please fill out all relevant sections to help reviewers understand your changes.

### Current Implementation Status

Check our [implementation status](/.claude/documentation/IMPLEMENTATION_STATUS.md) to see:

- What's completed
- What's in progress
- What needs help

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Assume good intentions

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Publishing private information

## Getting Help

- **Discord**: [Join our community](https://discord.gg/dxlander) (coming soon)
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions

## Recognition

Contributors will be:

- Listed in our README
- Acknowledged in release notes
- Invited to our contributor Discord channel

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make DXLander better! 🚀
