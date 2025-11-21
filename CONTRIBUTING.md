# Contributing to TaskFlow

Thank you for your interest in contributing to TaskFlow! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check the [existing issues](https://github.com/ngeff/taskflow/issues) to avoid duplicates
2. Use the latest version of the project
3. Collect relevant information (OS, Node version, browser, etc.)

When submitting a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Environment details

### Suggesting Features

Feature requests are welcome. Please provide:

- A clear description of the feature
- The problem it solves
- Potential implementation approach
- Any alternatives you've considered

### Pull Requests

1. **Fork and clone** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our coding standards
4. **Write/update tests** for your changes
5. **Run the test suite** to ensure nothing is broken
6. **Commit your changes** using conventional commits
7. **Push** to your fork and submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

```bash
# Clone your fork
git clone https://github.com/ngeff/taskflow.git
cd taskflow

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start development servers
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

## Coding Standards

### General

- Use meaningful variable and function names
- Keep functions small and focused
- Write self-documenting code
- Add comments only when necessary to explain "why", not "what"

### JavaScript/React

- Use ES6+ features
- Prefer functional components with hooks
- Use destructuring where appropriate
- Follow the existing code style

### Git Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(tasks): add drag-and-drop reordering
fix(api): resolve task deletion error
docs(readme): update installation instructions
```

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Code refactoring

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Writing Tests

- Write tests for new features
- Update tests when modifying existing features
- Aim for meaningful coverage, not 100%

## Project Structure

```
taskflow/
├── backend/
│   └── src/
│       ├── controllers/    # Request handlers
│       ├── middleware/     # Express middleware
│       ├── routes/         # Route definitions
│       ├── services/       # Business logic
│       └── index.js        # Entry point
│
└── frontend/
    └── src/
        ├── components/     # React components
        ├── hooks/          # Custom hooks
        ├── services/       # API client
        └── App.jsx         # Root component
```

## Review Process

1. All PRs require at least one approving review
2. CI checks must pass
3. No merge conflicts with `main`
4. Commits should be squashed if necessary

## Questions?

Feel free to open an issue for any questions about contributing.

---

Thank you for contributing