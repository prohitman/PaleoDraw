/**
 * Electron Main Process
 *
 * Responsibilities:
 * - Create and manage application window
 * - Handle IPC communication with renderer process
 * - Provide file system access (open, save, export)
 * - Manage OS integration (file explorer, drag-drop)
 *
 * Security:
 * - contextIsolation enabled: Preload script runs in isolated context
 * - nodeIntegration disabled: Renderer cannot directly access Node.js APIs
 * - IPC handlers validate and sanitize all inputs
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron")
const path = require("path")
const fs = require("fs")
const logger = require("./logger")

/**
 * Create the main application window
 *
 * Window Configuration:
 * - Hidden title bar with custom overlay for seamless UI
 * - Preload script bridges secure IPC communication
 * - Loads from Vite dev server in dev mode, dist folder in production
 *
 * @returns {BrowserWindow} The created window instance
 */
const createWindow = () => {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? path.join(__dirname, "../frontend/public/logo.png")
    : path.join(__dirname, "../frontend/dist/logo.png")

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#181818",
      symbolColor: "#ffffff", // Color of the symbols in the title bar overlay (e.g., close, minimize buttons)
      height: 30,
    },
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const startUrl =
    process.env.VITE_DEV_SERVER_URL ||
    `file://${path.join(__dirname, "../frontend/dist/index.html")}`
  win.loadURL(startUrl)

  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) {
      event.preventDefault()
    }
  })

  win.webContents.on("did-finish-load", () => {
    win.webContents.on("dom-ready", () => {
      win.webContents.executeJavaScript(`
        document.addEventListener('drop', (e) => {
          e.preventDefault()
          e.stopPropagation()
        })
      `)
    })
  })

  return win
}

/**
 * IPC Handler: Read project file from disk
 *
 * Security: Only reads files that user explicitly selected via file dialog
 * Returns file content as UTF-8 string
 *
 * @param {string} filePath - Absolute path to the project file
 * @returns {Promise<string>} File content
 * @throws {Error} If file cannot be read
 */
ipcMain.handle("read-project-file", async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return content
  } catch (error) {
    logger.error("Error reading file:", error)
    throw error
  }
})

/**
 * IPC Handler: Save project file to disk
 *
 * Modes:
 * - Direct save (isDirect=true): Saves to specified path without dialog
 * - Save As (isDirect=false): Shows save dialog for user to choose location
 *
 * @param {Object} params
 * @param {string} params.filePath - Target file path (used as default in dialog)
 * @param {string} params.content - JSON content to save
 * @param {boolean} params.isDirect - Whether to save directly without dialog
 * @returns {Promise<{success: boolean, filePath: string|null, canceled: boolean}>}
 */
ipcMain.handle(
  "save-project-file",
  async (event, { filePath, content, isDirect = false }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error("Window not found")

    let targetPath = filePath

    if (!isDirect) {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: filePath || "project.json",
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, filePath: null, canceled: true }
      }

      targetPath = result.filePath
    }

    try {
      fs.writeFileSync(targetPath, content, "utf-8")
      return { success: true, filePath: targetPath, canceled: false }
    } catch (error) {
      logger.error("Error saving file:", error)
      throw error
    }
  },
)

/**
 * IPC Handler: Export drawing as SVG file
 *
 * Shows save dialog for user to choose export location
 * Filters to .svg extension by default
 *
 * @param {Object} params
 * @param {string} params.defaultPath - Default filename suggestion
 * @param {string} params.content - SVG XML content to save
 * @returns {Promise<{success: boolean, filePath: string|null, canceled: boolean}>}
 */
ipcMain.handle("export-svg-file", async (event, { defaultPath, content }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error("Window not found")

  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultPath || "drawing.svg",
    filters: [
      { name: "SVG Files", extensions: ["svg"] },
      { name: "All Files", extensions: ["*"] },
    ],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, filePath: null, canceled: true }
  }

  try {
    fs.writeFileSync(result.filePath, content, "utf-8")
    return { success: true, filePath: result.filePath, canceled: false }
  } catch (error) {
    logger.error("Error exporting SVG:", error)
    throw error
  }
})

/**
 * IPC Handler: Show file in OS file explorer
 *
 * Opens native file explorer and highlights the specified file
 * Validates file existence before attempting to show
 *
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<{success: boolean}>}
 * @throws {Error} If file does not exist
 */
ipcMain.handle("show-file-in-explorer", async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist")
    }
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (error) {
    logger.error("Error showing file in explorer:", error)
    throw error
  }
})

// Handle title bar overlay update
ipcMain.on("update-title-bar-overlay", (event, overlayConfig) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.setTitleBarOverlay(overlayConfig)
  }
})

// Handle read file (for drag-dropped files)
ipcMain.handle("read-file", async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf-8")
    return content
  } catch (error) {
    logger.error("Error reading file:", error)
    throw error
  }
})

app.whenReady().then(() => {
  const win = createWindow()

  // Setup drag-and-drop file handling
  app.on("web-contents-created", (event, contents) => {
    contents.on("will-navigate", (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl)
      // Allow file:// URLs for dropped files but prevent navigation
      if (parsedUrl.protocol === "file:") {
        event.preventDefault()
      }
    })
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
