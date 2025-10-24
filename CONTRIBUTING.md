# Contributing to DXLander

Thank you for your interest in contributing to DXLander! We welcome contributions from everyone.

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
- **Testing**: Add tests for new features
- **Commits**: Use clear, descriptive commit messages
- **PRs**: Keep them focused and include clear descriptions

#### Pull Request Process

1. Create a feature branch: `git checkout -b feature-name`
2. Make your changes
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint:fix`
5. Commit your changes
6. Push to your fork
7. Open a pull request

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