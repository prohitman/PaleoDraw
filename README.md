# PaleoDraw

<div align="center">

![PaleoDraw Logo](frontend/public/logo.png)

**A specialized vector drawing application for creating precise paleontological illustrations and scientific diagrams**

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](package.json)
[![Electron](https://img.shields.io/badge/Electron-38.4.0-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

[Features](#-features) • [Getting Started](#-getting-started) • [Documentation](#-usage-guide) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Screenshots & Demo](#-screenshots--demo)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Usage Guide](#-usage-guide)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Building & Distribution](#-building--distribution)
- [Project Structure](#-project-structure)
- [Architecture](#-architecture)
- [Development](#-development)
- [Technologies](#-technologies)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [Support & Feedback](#-support--feedback)
- [License](#-license)

---

## 🎨 Overview

**PaleoDraw** is a desktop application designed specifically for paleontologists, scientific illustrators, and researchers who need to create precise, publication-quality vector drawings of fossils, skeletal structures, and other paleontological specimens.

Built with modern web technologies wrapped in Electron, PaleoDraw offers an intuitive interface for creating smooth splines, managing complex shapes, and producing clean vector graphics suitable for scientific papers, educational materials, and museum displays.

### ✨ Highlights

- 🦴 **Purpose-Built for Paleontology**: Specialized tools designed for fossil reconstruction workflows
- 🎯 **Professional Precision**: Create publication-ready illustrations with mathematical accuracy
- 🚀 **Modern & Fast**: Built with cutting-edge technologies (Electron, React, SVG.js)
- 🆓 **Free & Open Source**: No expensive licenses, fully transparent codebase
- 💻 **Cross-Platform**: Works seamlessly on Windows, macOS, and Linux
- 📦 **Portable Projects**: Simple JSON format for easy sharing and version control

### Why PaleoDraw?

- **Specialized for Paleontology**: Designed from the ground up for fossil illustration workflows
- **Precision Drawing**: Multiple spline types (B-Spline, Line, NURBS) for accurate reconstruction
- **Non-Destructive Workflow**: Comprehensive undo/redo system preserves your work
- **Grid-Based Accuracy**: Customizable grid system for precise measurements and alignment
- **Template Library**: Pre-built templates for common fossil types to jumpstart projects
- **Cross-Platform**: Runs on Windows, macOS, and Linux

---

## ✨ Features

### Drawing Tools

- **🎨 Multiple Spline Types**
  - B-Spline: Smooth, organic curves perfect for natural shapes
  - Line: Straight segments for angular features
  - NURBS: Mathematically precise curves with mixed smooth/sharp control

- **🎯 Precise Control**
  - Control point manipulation with visual feedback
  - Point snapping (Ctrl+drag) for exact alignment
  - Per-point sharpness control (sharp vs. smooth)
  - Dynamic point insertion and deletion

- **🔧 Advanced Editing**
  - Multi-object selection and manipulation
  - Multi-point selection for batch editing
  - Group operations (move, scale, rotate)
  - Z-ordering controls (bring forward/send backward)

### Project Management

- **💾 Robust File Operations**
  - JSON-based project format (.json)
  - SVG import and export
  - Auto-save dirty state tracking
  - Recent files history

- **📂 Template System**
  - Pre-built fossil templates (T-Rex, Spinosaurus, Triceratops, etc.)
  - Template browser with previews
  - Easy template loading

### User Experience

- **⌨️ Keyboard-Driven Workflow**
  - Comprehensive hotkey system
  - Scoped keyboard shortcuts (global, canvas, selection)
  - Customizable tool switching

- **🎨 Modern UI**
  - Light and dark themes
  - Material Design components
  - Responsive canvas with pan and zoom
  - Grid overlay for alignment

- **📚 Built-in Help System**
  - Comprehensive documentation
  - Tool descriptions and keyboard shortcuts
  - FAQ and troubleshooting

---

## 📸 Screenshots & Demo

### Application Interface

<img width="990" height="727" alt="Screenshot 2025-12-08 175050" src="https://github.com/user-attachments/assets/03a88ee1-9cb3-4a0c-a8bc-fb6a4261970b" />

<!-- Add your screenshots here -->
<!-- Example: -->
<!-- ![Main Interface](docs/screenshots/interface.png) -->
<!-- ![Drawing Tools](docs/screenshots/tools.png) -->
<!-- ![Template Selection](docs/screenshots/templates.png) -->

### Demo: Spinosaurus Reconstruction

<!-- Add your video here using one of these methods: -->

https://github.com/user-attachments/assets/f2c74ab5-376c-44ad-8055-5dad6dc3e2ae

<!-- Method 1: Direct GitHub video (upload to issue/PR, then copy URL) -->
<!--
https://user-images.githubusercontent.com/YOUR_USER/YOUR_VIDEO.mp4
-->

<!-- Method 2: YouTube embed (replace with your video) -->
<!--
[![Spinosaurus Reconstruction Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
-->

<!-- Method 3: GIF -->
<!--
![Spinosaurus Reconstruction](docs/demo.gif)
-->

> 💡 **Tip**: Click the image above to watch the full reconstruction process

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** - [Download](https://git-scm.com/)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/prohitman/PaleoDraw.git
cd PaleoDraw
```

2. **Install dependencies**

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

That's it! You're ready to run the application.

#### Troubleshooting

<details>
<summary>Installation issues</summary>

**Node version mismatch:**

```bash
# Check your Node.js version
node --version

# Required: v18 or higher
```

**npm install fails:**

```bash
# Clear npm cache and retry
npm cache clean --force
npm install
```

**Permission errors (Linux/macOS):**

```bash
# Don't use sudo with npm
# Instead, fix npm permissions:
# https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

</details>

### Running the Application

#### Development Mode

Run the application in development mode with hot-reloading:

```bash
npm run dev
```

This command:

- Starts the Vite dev server (frontend)
- Waits for the dev server to be ready
- Launches Electron in development mode

The application will open automatically, and changes to the code will trigger hot-reloading.

#### Production Mode

Build and run the production version:

```bash
# Build the frontend
npm run build

# Start in production mode
npm start
```

---

## 📦 Building & Distribution

### Build for Distribution

Create distributable packages for your platform:

```bash
npm run dist
```

This uses `electron-builder` to create platform-specific installers:

- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

Built files will be in the `dist/` directory.

### Configuration

Build configuration is in `package.json` under the `build` key:

```json
{
  "build": {
    "appId": "com.aminelahnin.paleodraw",
    "productName": "PaleoDraw",
    "win": {
      "target": "nsis",
      "icon": "frontend/public/logo.ico"
    }
  }
}
```

---

## 📁 Project Structure

```
PaleoDraw/
├── electron/                    # Electron main process
│   ├── main.js                 # Main process entry point
│   └── preload.js              # Preload script for IPC bridge
├── frontend/                    # React frontend application
│   ├── public/                 # Static assets
│   │   ├── docs/              # Help documentation
│   │   └── templates/         # Fossil templates
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Canvas.jsx     # Main drawing canvas
│   │   │   ├── ToolBar.jsx    # Toolbar component
│   │   │   └── ...
│   │   ├── core/              # Core systems
│   │   │   └── EventBus.js    # Event system
│   │   ├── handlers/          # Event handlers
│   │   │   ├── tools/         # Tool-specific handlers
│   │   │   ├── interactions/  # Canvas interaction handlers
│   │   │   └── ...
│   │   ├── managers/          # Business logic managers
│   │   │   ├── SplineManager.js
│   │   │   ├── ProjectManager.js
│   │   │   ├── HistoryManager.js
│   │   │   └── ...
│   │   ├── models/            # Data models
│   │   │   └── Spline.js
│   │   ├── services/          # Service layer
│   │   │   ├── ProjectService.js
│   │   │   └── FileService.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── geometry.js    # Spline path generation
│   │   │   ├── svgHelpers.js  # SVG utilities
│   │   │   └── ...
│   │   └── input/             # Input handling
│   │       ├── HotkeysManager.js
│   │       └── ...
│   ├── index.html             # HTML entry point
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js         # Vite configuration
├── package.json               # Root package.json
└── README.md                  # This file
```

---

## 🏗️ Architecture

### Design Patterns

**PaleoDraw** follows a clean architecture with clear separation of concerns:

#### **Manager Pattern**

Core business logic is encapsulated in manager classes:

- `SplineManager`: CRUD operations for splines
- `ProjectManager`: Project lifecycle and file operations
- `HistoryManager`: Undo/redo state management
- `SVGObjectManager`: Imported SVG object management
- `SelectionManager`: Multi-selection handling

#### **Event-Driven Architecture**

The `EventBus` singleton provides decoupled communication:

- Managers emit events for state changes
- Components and plugins subscribe to relevant events
- No direct dependencies between managers

Example events:

- `spline:created`, `spline:modified`, `spline:deleted`
- `svg:imported`, `svg:selected`
- `selection:changed`
- `history:saved`

#### **Plugin System**

Extensible plugin architecture for cross-cutting concerns:

- `AutoHistoryPlugin`: Automatically captures history on modifications
- Plugins subscribe to EventBus events
- Easy to add new functionality without modifying core code

#### **Tool Registry Pattern**

Drawing tools are registered handlers:

- Each tool implements `click`, `move`, `keydown` handlers
- Tools are activated/deactivated dynamically
- Clean separation of tool-specific logic

### Data Flow

```
User Input → Event Handlers → Managers → EventBus → UI Updates
                                ↓
                          HistoryManager
                                ↓
                            Undo/Redo
```

---

## 📖 Usage Guide

### Creating Your First Drawing

1. **Start a New Project**
   - Click `File → New Project` or press `Ctrl+N`
   - A blank canvas appears with a grid

2. **Select the Curve Tool**
   - Press `C` or select from Tools menu
   - The cursor changes to indicate curve mode

3. **Draw a Spline**
   - Click on the canvas to place control points
   - The curve automatically smooths between points
   - Press `Escape` to finish drawing

4. **Edit Points**
   - Press `T` to switch to Select tool
   - Click on the spline to select it
   - Drag control points to reshape
   - Hold `Ctrl` while dragging to snap to nearby points

5. **Save Your Work**
   - Press `Ctrl+S` to save
   - Choose a location for your `.json` project file

### Working with Templates

1. **Open Templates Dialog**
   - Click `File → New from Template`
   - Browse available fossil templates

2. **Load a Template**
   - Click on a template to preview
   - Click "Load Template" to start

3. **Customize**
   - Edit the template splines to match your specimen
   - Add new splines as needed

### Importing SVG Files

1. **Import SVG**
   - Press `I` or select `File → Import SVG`
   - Choose an SVG file from your computer

2. **Position and Scale**
   - The imported SVG appears as a selectable object
   - Drag to move, use resize handles to scale
   - Use rotation handle to rotate

### Exporting Your Work

**Export as SVG** (for use in other applications):

- Press `Ctrl+E` or select `File → Export as SVG`
- Choose a filename and location
- The SVG file can be opened in Inkscape, Illustrator, etc.

---

## ⌨️ Keyboard Shortcuts

### Tools

| Key | Action                |
| --- | --------------------- |
| `T` | Select Tool           |
| `C` | Curve Tool (B-Spline) |
| `L` | Line Tool             |
| `N` | NURBS Tool            |
| `P` | Delete Spline Tool    |
| `I` | Import SVG            |

### File Operations

| Key            | Action               |
| -------------- | -------------------- |
| `Ctrl+N`       | New Project          |
| `Ctrl+O`       | Open Project         |
| `Ctrl+S`       | Save Project         |
| `Ctrl+Shift+S` | Save As              |
| `Ctrl+E`       | Export as SVG        |
| `Ctrl+Shift+O` | Open Recent Projects |

### Editing

| Key      | Action                                 |
| -------- | -------------------------------------- |
| `Ctrl+Z` | Undo                                   |
| `Ctrl+Y` | Redo                                   |
| `Ctrl+C` | Copy                                   |
| `Ctrl+V` | Paste                                  |
| `Ctrl+X` | Cut                                    |
| `Delete` | Delete Selected                        |
| `R`      | Toggle Point Direction (while drawing) |

### Object Manipulation

| Key               | Action                |
| ----------------- | --------------------- |
| `Ctrl+Drag Point` | Snap to Nearest Point |
| `Ctrl+F`          | Bring Forward         |
| `Ctrl+Shift+F`    | Bring to Front        |
| `Ctrl+B`          | Send Backward         |
| `Ctrl+Shift+B`    | Send to Back          |

### Navigation

| Key            | Action                    |
| -------------- | ------------------------- |
| `Space+Drag`   | Pan Canvas                |
| `Scroll Wheel` | Zoom In/Out               |
| `Escape`       | Deselect / Finish Drawing |

---

## 🛠️ Development

### Technology Stack

**Frontend:**

- React 19.1.1
- Material-UI (MUI) 7.3.5
- SVG.js 3.2.5 (vector graphics manipulation)
- Vite 7.1.7 (build tool)
- Tailwind CSS 4.1.17

**Backend:**

- Electron 38.4.0 (desktop framework)
- Node.js native APIs for file operations

**State Management:**

- EventBus pattern (pub/sub)
- Manager classes for business logic
- Immer for immutable state updates

### Code Style

- **ES6+ JavaScript**: Modern syntax throughout
- **JSDoc Comments**: Comprehensive documentation
- **Functional Components**: React hooks-based components
- **Class-based Managers**: OOP for business logic

### Adding a New Tool

1. **Create tool handler file**

```javascript
// frontend/src/handlers/tools/toolMyTool.js
export const myToolHandlers = {
  click: (e, context) => {
    // Handle click event
  },
  move: (e, context) => {
    // Handle mouse move
  },
  keydown: (e, context) => {
    // Handle keyboard input
  },
}
```

2. **Register tool in ToolRegistry**

```javascript
// In setupToolHandlers.js
import { myToolHandlers } from "./toolMyTool.js"

registry.register("mytool", myToolHandlers)
```

3. **Add menu item and hotkey**

```javascript
// In objectHotkeys.js or canvasHotkeys.js
hotkeysManager.register(
  "m",
  "canvas",
  () => {
    eventBus.emit("tool:changed", "mytool")
  },
  "My Tool",
)
```

### EventBus Events

Subscribe to events:

```javascript
import eventBus from "./core/EventBus.js"

eventBus.on("spline:created", (splineId) => {
  // Handle spline creation
})
```

Emit events:

```javascript
eventBus.emit("spline:modified", splineId, changes)
```

Common events:

- `spline:created`, `spline:modified`, `spline:deleted`
- `svg:imported`, `svg:selected`
- `selection:changed`
- `tool:changed`
- `history:saved`

---

## 🔧 Technologies

### Core Dependencies

| Package     | Version      | Purpose                       |
| ----------- | ------------ | ----------------------------- |
| Electron    | 38.4.0       | Desktop application framework |
| React       | 19.1.1       | UI library                    |
| SVG.js      | 3.2.5        | Vector graphics manipulation  |
| Material-UI | 7.3.5        | UI components                 |
| hotkeys-js  | 4.0.0-beta.6 | Keyboard shortcut handling    |
| immer       | 10.2.0       | Immutable state updates       |

### Development Tools

| Tool             | Purpose                        |
| ---------------- | ------------------------------ |
| Vite             | Fast build tool and dev server |
| ESLint           | Code linting                   |
| Tailwind CSS     | Utility-first CSS framework    |
| electron-builder | Packaging and distribution     |

---

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, improving documentation, or creating templates, your help is appreciated.

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**: Run the app in dev mode (`npm run dev`)
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Guidelines

- Follow existing code style and patterns
- Add JSDoc comments to functions and classes
- Use the logger utility instead of console.log
- Test your changes thoroughly before submitting
- Update documentation if you add new features

### Areas for Contribution

- **Bug Reports**: Found a bug? [Open an issue](../../issues/new)
- **Feature Requests**: Have an idea? [Share it](../../issues/new)
- **Templates**: Create fossil templates for the community
- **Documentation**: Improve guides and help content
- **Translations**: Help localize PaleoDraw (future)
- **Testing**: Help test on different platforms

For detailed development guidelines, see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

---

## 📄 License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Amine Lahnin**

<!-- Add your links here -->
<!-- - GitHub: [@your-username](https://github.com/your-username) -->
<!-- - LinkedIn: [Your Name](https://linkedin.com/in/your-profile) -->
<!-- - Website: [yourwebsite.com](https://yourwebsite.com) -->

---

## 🙏 Acknowledgments

- Built for paleontologists and scientific illustrators worldwide
- Inspired by traditional fossil illustration techniques and modern vector tools
- Powered by open-source technologies
- Special thanks to the contributors and the open-source community

---

## 📞 Support & Feedback

Need help or have suggestions?

- 📖 **Documentation**: Built-in help system (`Help → Documentation` in app)
- 🐛 **Bug Reports**: [Open an issue](../../issues/new?template=bug_report.md)
- 💡 **Feature Requests**: [Submit an idea](../../issues/new?template=feature_request.md)
- 💬 **Discussions**: [Join the conversation](../../discussions)
- 📧 **Email**: [Your email for direct contact]

---

## 🗺️ Roadmap

Future enhancements planned:

- [ ] Cloud synchronization and backup
- [ ] Collaborative editing features
- [ ] Advanced measurement tools (scale bars, rulers)
- [ ] Layer system for complex illustrations
- [ ] Export to additional formats (PDF, PNG, TIFF)
- [ ] Plugin system for community extensions
- [ ] Mobile companion app (view-only)

See [open issues](../../issues) for a full list of proposed features and known issues.

---

## ⭐ Star History

If you find PaleoDraw useful, please consider giving it a star! It helps others discover the project.

---

<div align="center">

Made with ❤️ for the paleontology community

</div>
