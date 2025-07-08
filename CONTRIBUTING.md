# Contributing to SILC Protocol

First off, thank you for considering contributing to SILC Protocol! It's people like you that make SILC Protocol such a great tool for the AI community.

## Code of Conduct

This project and everyone participating in it is governed by the [SILC Protocol Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to silc-protocol@example.com.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible. Fill out [the required template](.github/ISSUE_TEMPLATE/bug_report.md), the information it asks for helps us resolve issues faster.

**Note:** If you find a **Closed** issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Before creating enhancement suggestions, please check the existing issues as you might find out that you don't need to create one. When you are creating an enhancement suggestion, please include as many details as possible. Fill in [the template](.github/ISSUE_TEMPLATE/feature_request.md), including the steps that you imagine you would take if the feature you're requesting existed.

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these `beginner` and `help-wanted` issues:

* [Beginner issues](https://github.com/yourusername/silc-protocol/labels/beginner) - issues which should only require a few lines of code, and a test or two.
* [Help wanted issues](https://github.com/yourusername/silc-protocol/labels/help%20wanted) - issues which should be a bit more involved than `beginner` issues.

### Pull Requests

The process described here has several goals:

- Maintain SILC Protocol's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible SILC Protocol
- Enable a sustainable system for SILC Protocol's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in [the template](.github/pull_request_template.md)
2. Follow the [styleguides](#styleguides)
3. After you submit your pull request, verify that all [status checks](https://help.github.com/articles/about-status-checks/) are passing

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### Setting Up Your Development Environment

1. Fork the repo on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/silc-protocol.git
   cd silc-protocol
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Make your changes and ensure tests pass:
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

### Development Workflow

1. Make your changes in a new git branch
2. Add or update tests for your changes
3. Ensure all tests pass and coverage remains high
4. Update documentation if needed
5. Commit your changes using conventional commits
6. Push your branch and create a pull request

## Styleguides

### Git Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). This leads to more readable messages that are easy to follow when looking through the project history. Also, we use the git commit messages to generate the SILC Protocol change log.

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **perf**: A code change that improves performance
* **test**: Adding missing tests or correcting existing tests
* **build**: Changes that affect the build system or external dependencies
* **ci**: Changes to our CI configuration files and scripts
* **chore**: Other changes that don't modify src or test files

#### Scope

The scope should be the name of the npm package affected (as perceived by the person reading the changelog generated from commit messages):

* **core**
* **signal**
* **memory**
* **dialect**
* **transport**
* **security**
* **bridge**

#### Examples

```
feat(signal): add harmonic coefficient encoding

Add support for encoding complex harmonic patterns using IEEE754
float representation. This enables more nuanced signal communication
between AI agents.

Closes #123
```

```
fix(memory): prevent race condition in window allocation

Use atomic operations to ensure thread-safe window allocation
when multiple agents request memory simultaneously.

Fixes #456
```

### TypeScript Styleguide

* Use TypeScript for all new code
* Follow the existing code style enforced by ESLint and Prettier
* Prefer interfaces over type aliases for object shapes
* Use explicit return types for all functions
* Document all public APIs with JSDoc comments
* Use meaningful variable and function names

### Testing Styleguide

* Write tests for all new functionality
* Follow the AAA pattern: Arrange, Act, Assert
* Use descriptive test names that explain what is being tested
* Mock external dependencies appropriately
* Aim for high code coverage but focus on meaningful tests

## Project Structure

```
silc/
├── src/
│   ├── core/        # Core protocol implementation
│   ├── signal/      # Signal encoding/decoding
│   ├── memory/      # Memory management
│   ├── dialect/     # Dialect system
│   ├── transport/   # Transport layers
│   ├── security/    # Security features
│   ├── bridge/      # Protocol bridges
│   ├── types/       # TypeScript type definitions
│   └── utils/       # Utility functions
├── tests/
│   ├── unit/        # Unit tests
│   ├── integration/ # Integration tests
│   └── performance/ # Performance tests
├── docs/            # Documentation
├── examples/        # Example usage
└── benchmarks/      # Performance benchmarks
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

## Documentation

* Update the README.md with details of changes to the interface
* Update the inline JSDoc comments for any API changes
* Run `npm run docs` to generate the documentation and verify it looks correct

## Financial Contributions

We also welcome financial contributions. Please contact us at silc-protocol@example.com for more information.

## Questions?

Feel free to open an issue with your question or contact the maintainers directly.

Thank you for contributing to SILC Protocol! 🎉