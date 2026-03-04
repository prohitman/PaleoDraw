# Contributing to PaleoDraw

Thank you for your interest in contributing to PaleoDraw! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and constructive in all interactions.

### Expected Behavior

- ✅ Be respectful and inclusive
- ✅ Provide constructive feedback
- ✅ Accept constructive criticism gracefully
- ✅ Focus on what's best for the project
- ✅ Show empathy towards other contributors

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Basic knowledge of JavaScript, React, and Electron
- Familiarity with SVG graphics (helpful but not required)

### Setting Up Development Environment

1. **Fork the repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/PaleoDraw.git
   cd PaleoDraw
   ```

2. **Install dependencies**

   ```bash
   npm install
   cd frontend
   npm install
   cd ..
   ```

3. **Run in development mode**

   ```bash
   npm run dev
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions or modifications

### Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/add-circle-tool

# 2. Make your changes
# ... edit files ...

# 3. Test your changes
npm run dev

# 4. Commit your changes
git add .
git commit -m "feat: Add circle drawing tool"

# 5. Push to your fork
git push origin feature/add-circle-tool

# 6. Create Pull Request on GitHub
```

---

## Code Style Guidelines

### JavaScript/JSX Style

#### General Principles

- Use ES6+ syntax
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Destructure objects and arrays when possible

#### Naming Conventions

```javascript
// Classes and Constructors: PascalCase
class SplineManager {}

// Functions and Variables: camelCase
const createSpline = () => {}
let selectedTool = "curve"

// Constants: UPPER_SNAKE_CASE
const MAX_HISTORY_SIZE = 50
const GRID_BASE_THICKNESS = 0.5

// Private properties: _prefixed
class Spline {
  _internalState = null
}

// React Components: PascalCase
function ToolBar() {}
const Canvas = forwardRef(() => {})
```

#### File Organization

```javascript
// 1. Imports (grouped and organized)
import { useState, useRef } from "react" // React
import { Button } from "@mui/material" // Third-party
import SplineManager from "../managers/Spline" // Local modules
import { drawGrid } from "../utils/svgHelpers" // Local utils
import "./styles.css" // Styles

// 2. Constants
const DEFAULT_GRID_SIZE = 25

// 3. Helper functions
function calculateDistance(p1, p2) {}

// 4. Main component/class
export default function Component() {}
```

### JSDoc Comments

All public functions, classes, and methods should have JSDoc comments:

```javascript
/**
 * Create a new spline with specified type
 *
 * @param {Object} options - Configuration options
 * @param {string} options.type - Spline type ('bspline', 'polyline', 'nurbs')
 * @param {boolean} [options.autoSelect=true] - Auto-select after creation
 * @returns {Spline} The created spline instance
 * @throws {Error} If draw instance is not initialized
 *
 * @example
 * const spline = manager.createSpline({ type: 'bspline' })
 */
createSpline(options) {
  // Implementation
}
```

### React Component Style

```javascript
/**
 * ToolBar Component: Main toolbar with drawing tools and file operations
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onToolSelect - Callback when tool is selected
 * @param {string} props.selectedTool - Currently active tool
 */
export default function ToolBar({ onToolSelect, selectedTool }) {
  // Hooks at top
  const [anchorEl, setAnchorEl] = useState(null)
  const menuRef = useRef(null)

  // Event handlers
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  // Render
  return <div className="toolbar">{/* Component JSX */}</div>
}
```

### Manager Classes Style

```javascript
/**
 * SplineManager: Centralized API for spline operations
 *
 * Responsibilities:
 * - CRUD operations for splines
 * - Event emission via EventBus
 * - Integration with HistoryManager
 */
export default class SplineManager {
  constructor({ draw, historyManager }) {
    this.draw = draw
    this.splines = new Map()
    this.historyManager = historyManager
  }

  /**
   * Create a new spline
   * @param {Object} options - Configuration options
   * @returns {Spline} Created spline instance
   */
  createSpline(options) {
    // Implementation
    eventBus.emit("spline:created", spline.id)
    return spline
  }
}
```

---

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, tooling, dependencies

### Examples

```bash
# Feature
feat(spline): Add NURBS spline support

Implements NURBS (Non-Uniform Rational B-Spline) drawing tool
with per-point sharpness control.

- Add generateNurbsPath utility function
- Register NURBS tool handlers
- Add 'N' keyboard shortcut

Closes #42

# Bug Fix
fix(history): Prevent duplicate state pushes

Check if new state is identical to last state before pushing
to history stack to avoid cluttering undo/redo.

# Documentation
docs(readme): Update installation instructions

Add prerequisites section and clarify Node.js version requirement.

# Refactor
refactor(managers): Extract selection logic to SelectionManager

Move multi-selection logic from SplineManager to dedicated
SelectionManager for better separation of concerns.
```

### Commit Message Best Practices

- ✅ Use present tense ("Add feature" not "Added feature")
- ✅ Keep subject line under 72 characters
- ✅ Capitalize subject line
- ✅ Don't end subject with period
- ✅ Use body to explain _what_ and _why_, not _how_
- ✅ Reference issues and PRs in footer

---

## Pull Request Process

### Before Submitting

1. **Test your changes thoroughly**

   ```bash
   npm run dev  # Test in development
   npm run build  # Ensure build works
   ```

2. **Update documentation**

   - Update README if features changed
   - Add/update JSDoc comments
   - Update help.html if UI changed

3. **Check code style**

   ```bash
   npm run lint  # If linting is configured
   ```

4. **Clean commit history**
   ```bash
   # Squash related commits if needed
   git rebase -i HEAD~3
   ```

### Submitting Pull Request

1. **Push to your fork**

   ```bash
   git push origin feature/your-feature
   ```

2. **Create PR on GitHub**

   - Use clear, descriptive title
   - Reference related issues
   - Describe changes in detail
   - Add screenshots for UI changes

3. **PR Template**

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Refactoring

   ## Testing

   Describe testing performed

   ## Screenshots

   (if applicable)

   ## Related Issues

   Closes #123
   ```

### After Submitting

- Respond to review feedback promptly
- Make requested changes in new commits
- Once approved, maintainer will merge

---

## Testing

### Manual Testing Checklist

When adding new features, test:

- ✅ Feature works as expected
- ✅ Existing features still work (no regression)
- ✅ Undo/redo works correctly
- ✅ File save/load preserves changes
- ✅ Works in both light and dark themes
- ✅ Keyboard shortcuts work
- ✅ No console errors

### Test Scenarios

#### For Drawing Tools

- Create splines with various point counts
- Edit existing splines
- Undo/redo operations
- Save and reload project
- Export as SVG

#### For UI Changes

- Test in light and dark themes
- Test with different window sizes
- Test keyboard shortcuts
- Test menu interactions

---

## Documentation

### What to Document

1. **Code Comments**

   - Complex algorithms
   - Non-obvious decisions
   - Workarounds for issues

2. **JSDoc Comments**

   - All public functions
   - All classes and methods
   - Complex parameters

3. **README Updates**

   - New features
   - Changed workflows
   - New dependencies

4. **Help Documentation**
   - New tools or features
   - Changed keyboard shortcuts
   - New workflows

### Documentation Style

```javascript
/**
 * Good: Clear, explains why and what
 */
// Use hybrid path generation for NURBS to support per-point
// sharpness control, allowing mix of smooth and sharp corners
const path = generateHybridPath(points)

/**
 * Bad: States the obvious
 */
// Generate the path
const path = generateHybridPath(points)
```

---

## Architecture Overview

Understanding the architecture helps make better contributions:

### Manager Pattern

```
SplineManager     → Handles spline CRUD
HistoryManager    → Manages undo/redo
ProjectManager    → Manages project lifecycle
SelectionManager  → Handles multi-selection
```

### Event-Driven Communication

```
Manager → EventBus.emit('event:name', data)
         ↓
Plugin/Component → EventBus.on('event:name', handler)
```

### Tool System

```
ToolRegistry → Registers tool handlers
             ↓
Tool Handlers → { click, move, keydown }
             ↓
Canvas → Dispatches events to active tool
```

---

## Questions?

- Check existing issues and PRs
- Review documentation in `frontend/public/docs/`
- Open a discussion on GitHub
- Contact the maintainer

---

## License

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to PaleoDraw! 🎨
