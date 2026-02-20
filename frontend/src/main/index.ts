import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, nativeImage, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

// Test client mode: separate userData, no single-instance lock, no protocol, different hotkeys
// Detect via env var OR --user-data-dir containing 'blackfyre-hud-test' (env var may not
// survive electron-vite's build/spawn chain, but the CLI flag always does)
const isTestClient = process.env.BLACKFYRE_TEST_CLIENT === '1' ||
  process.argv.some(arg => arg.includes('blackfyre-hud-test'))

if (isTestClient) {
  const testDataDir = app.getPath('userData') + '-test'
  if (!existsSync(testDataDir)) mkdirSync(testDataDir, { recursive: true })
  app.setPath('userData', testDataDir)
  app.setPath('sessionData', testDataDir)
  // Disable GPU shader disk cache to avoid lock conflicts with the primary instance
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

// Simple JSON store (replaces electron-store to avoid ESM issues)
const storePath = join(app.getPath('userData'), 'config.json')

function storeGet(key: string): unknown {
  try {
    if (!existsSync(storePath)) return null
    const data = JSON.parse(readFileSync(storePath, 'utf-8'))
    return key.split('.').reduce((o, k) => o?.[k], data) ?? null
  } catch { return null }
}

function storeSet(key: string, value: unknown): void {
  let data: Record<string, unknown> = {}
  try {
    if (existsSync(storePath)) {
      data = JSON.parse(readFileSync(storePath, 'utf-8'))
    }
  } catch { /* start fresh */ }
  const keys = key.split('.')
  let obj: Record<string, unknown> = data
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) {
      obj[keys[i]] = {}
    }
    obj = obj[keys[i]] as Record<string, unknown>
  }
  obj[keys[keys.length - 1]] = value
  const dir = join(app.getPath('userData'))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(storePath, JSON.stringify(data, null, 2))
}

function storeDelete(key: string): void {
  storeSet(key, undefined)
}

const isDev = process.env.NODE_ENV === 'development'

// App icon for window taskbar / title bar
const appIconPath = join(__dirname, '../../resources/images/art/appIcon.png')

let loginWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let tray: Tray | null = null
let intentionalHide = false
let layoutEditMode = false
let lastAutoSeq = 0

// Custom protocol for Discord OAuth callback
const PROTOCOL = 'blackfyre'

// Test client skips protocol registration (primary client owns it)
if (!isTestClient) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

// Prevent multiple instances (test client skips this to allow running alongside primary)
if (!isTestClient) {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, commandLine) => {
      // Handle protocol URL from second instance
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`))
      if (url) {
        handleAuthCallback(url)
      }
      if (loginWindow) {
        if (loginWindow.isMinimized()) loginWindow.restore()
        loginWindow.focus()
      }
    })
  }
}

function handleAuthCallback(url: string): void {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    if (token) {
      storeSet('auth.token', token)
      if (loginWindow) {
        loginWindow.webContents.send('auth:success', { token })
      }
    }
  } catch (err) {
    console.error('Failed to parse auth callback URL:', err)
  }
}

function createLoginWindow(): void {
  loginWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    center: true,
    show: false,
    icon: appIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loginWindow.on('ready-to-show', () => {
    loginWindow?.show()
  })

  loginWindow.on('closed', () => {
    loginWindow = null
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    loginWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    loginWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createHudWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  hudWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    minimizable: false,
    skipTaskbar: false,
    resizable: false,
    focusable: true,
    hasShadow: false,
    icon: appIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Start in click-through mode; renderer auto-detect will flip as needed
  hudWindow.setIgnoreMouseEvents(true, { forward: true })

  // Use highest always-on-top level so HUD never drops behind other windows
  hudWindow.setAlwaysOnTop(true, 'screen-saver')

  // Prevent the window from being minimized by OS focus changes
  hudWindow.on('minimize', () => {
    if (intentionalHide) return
    hudWindow?.restore()
    hudWindow?.setAlwaysOnTop(true, 'screen-saver')
    hudWindow?.moveTop()
  })

  // Re-assert always-on-top when the window loses focus (e.g. click-through sends focus elsewhere)
  hudWindow.on('blur', () => {
    if (hudWindow && !hudWindow.isDestroyed() && !intentionalHide) {
      hudWindow.setAlwaysOnTop(true, 'screen-saver')
      hudWindow.moveTop()
    }
  })

  // Guard against unexpected hide events (but allow intentional F3 hides)
  hudWindow.on('hide', () => {
    if (intentionalHide) return
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.show()
      hudWindow.setAlwaysOnTop(true, 'screen-saver')
      hudWindow.moveTop()
    }
  })

  hudWindow.on('closed', () => {
    hudWindow = null
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    hudWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/hud`)
  } else {
    hudWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/hud' })
  }
}

function createTray(): void {
  // Load tray icon: try file first, fall back to inline base64
  let icon: Electron.NativeImage
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  if (existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    // Fallback: inline 32x32 gold flame on dark background
    icon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABUUlEQVR4nGPg4uJnAOGmTN2epkzdE3TCPTB7USzn4uJ/Rg+M7Ai6W47uCIaBsBzZERQ54MOlvP8gPCAOeH026z8yprsDnh9P+////wyowBrHp6oBHh5L+/3m9GAWDxOjigLt74/6D8K/ns1EwTJzmDrixI/I/CH9/NAUFw8Rp6oArm0L/g/CXe71YMUyeZg44vzbwPwh/vNmGFcPkaeKAUyt8/8Pw+6t1WDGyGqo74Ngiz/8w/OZCOVaMrIbqDjg41/U/Mn55pgAFo8tT3QF7Zjj+R8bPjmeiYHR5qjpgxyTb/+j4yeFEFIxNDdUcsLnX4j8yfrgvCitGV0c1B6zrMPlPDqaaA1Y2G/zHhomVp0oiXFqr8x8ZkypPsQNAeEGFxn8QJlceYodQG5PlgC09RlvIkaNJiGwoEKjB4TpGgIDHgWjDqCFAge2aDXjndOB7p4AmB6sGoB1ARAAAAABJRU5ErkJggg==',
        'base64'
      )
    )
  }

  tray = new Tray(icon)
  tray.setToolTip(isTestClient ? 'Blackfyre HUD (TEST)' : 'Blackfyre HUD')

  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isTestClient ? 'Blackfyre HUD (TEST)' : 'Blackfyre HUD',
      enabled: false
    },
    { type: 'separator' },
    {
      label: hudWindow ? 'Show/Hide HUD' : 'HUD Not Active',
      enabled: !!hudWindow,
      click: () => {
        if (hudWindow) {
          if (hudWindow.isVisible()) {
            intentionalHide = true
            hudWindow.hide()
          } else {
            intentionalHide = false
            hudWindow.show()
            assertHudOnTop()
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Logout',
      click: () => {
        storeDelete('auth.token')
        if (hudWindow) {
          hudWindow.close()
          hudWindow = null
        }
        if (!loginWindow) {
          createLoginWindow()
        }
        updateTrayMenu()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

function assertHudOnTop(): void {
  if (!hudWindow || hudWindow.isDestroyed()) return
  if (intentionalHide) return
  hudWindow.setAlwaysOnTop(true, 'screen-saver')
  hudWindow.moveTop()
}

function registerGlobalShortcuts(): void {
  // Primary client: F3/F4 — Test client: F6/F7
  const visibilityKey = isTestClient ? 'F6' : 'F3'
  const layoutEditKey = isTestClient ? 'F7' : 'F4'

  // Toggle HUD visibility
  globalShortcut.register(visibilityKey, () => {
    if (hudWindow) {
      if (hudWindow.isVisible()) {
        intentionalHide = true
        hudWindow.hide()
      } else {
        intentionalHide = false
        hudWindow.show()
        assertHudOnTop()
      }
    }
  })

  // Toggle layout edit mode
  globalShortcut.register(layoutEditKey, () => {
    if (!hudWindow) return
    layoutEditMode = !layoutEditMode

    if (layoutEditMode) {
      // Entering layout edit — force interactive so user can drag widgets
      hudWindow.setIgnoreMouseEvents(false)
    } else {
      // Exiting layout edit — resume auto click-through
      hudWindow.setIgnoreMouseEvents(true, { forward: true })
      lastAutoSeq = 0
    }

    hudWindow.webContents.send('hud:layout-edit-changed', layoutEditMode)
  })
}

// IPC Handlers
ipcMain.handle('auth:get-token', () => {
  return storeGet('auth.token')
})

ipcMain.handle('auth:set-token', (_event, token: string) => {
  storeSet('auth.token', token)
})

ipcMain.handle('auth:clear-token', () => {
  storeDelete('auth.token')
})

ipcMain.handle('auth:open-discord', (_event, url: string) => {
  // Open Discord OAuth in a child window so we can intercept the blackfyre:// redirect
  const authWindow = new BrowserWindow({
    width: 500,
    height: 700,
    parent: loginWindow || undefined,
    modal: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  authWindow.loadURL(url)

  // Intercept navigation to blackfyre:// protocol
  authWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (navUrl.startsWith(`${PROTOCOL}://`)) {
      event.preventDefault()
      handleAuthCallback(navUrl)
      authWindow.close()
    }
  })

  // Also catch redirects
  authWindow.webContents.on('will-redirect', (event, navUrl) => {
    if (navUrl.startsWith(`${PROTOCOL}://`)) {
      event.preventDefault()
      handleAuthCallback(navUrl)
      authWindow.close()
    }
  })
})

ipcMain.handle('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.handle('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

ipcMain.on('auth:login-success', () => {
  // Close login window and open HUD
  if (loginWindow) {
    loginWindow.close()
    loginWindow = null
  }
  createHudWindow()
  updateTrayMenu()
})

// HUD Layout persistence
ipcMain.handle('hud:save-layout', (_event, positions: Record<string, { x: number; y: number; width?: number; height?: number }>) => {
  storeSet('hudLayout.positions', positions)
})

ipcMain.handle('hud:load-layout', () => {
  return storeGet('hudLayout.positions') || null
})

// HUD Panel state persistence (open/closed/minimized)
ipcMain.handle('hud:save-panel-states', (_event, states: { openPanels: string[]; chat: { open: boolean; minimized: boolean } }) => {
  storeSet('hudLayout.panelStates', states)
})

ipcMain.handle('hud:load-panel-states', () => {
  return storeGet('hudLayout.panelStates') || null
})

// Last character persistence
ipcMain.handle('character:set-last', (_event, characterId: number) => {
  storeSet('lastCharacterId', characterId)
})

ipcMain.handle('character:get-last', () => {
  return storeGet('lastCharacterId') || null
})

ipcMain.on('hud:set-auto-clickthrough', (_event, data: { interactive: boolean; seq: number }) => {
  if (!hudWindow || layoutEditMode) return
  // Guard against out-of-order IPC messages
  if (data.seq <= lastAutoSeq) return
  lastAutoSeq = data.seq

  if (data.interactive) {
    hudWindow.setIgnoreMouseEvents(false)
  } else {
    hudWindow.setIgnoreMouseEvents(true, { forward: true })
    // Release keyboard focus so game receives input
    hudWindow.blur()
  }
})

// App lifecycle
app.whenReady().then(() => {
  createTray()

  // Primary: F3/F4 — Test client: F6/F7
  registerGlobalShortcuts()

  // Check for existing auth token
  const token = storeGet('auth.token')
  if (token) {
    // TODO: Validate token with backend before auto-login
    createHudWindow()
  } else {
    createLoginWindow()
  }

  updateTrayMenu()
})

app.on('window-all-closed', () => {
  // Keep app running in tray
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Handle protocol URL on Windows
app.on('open-url', (_event, url) => {
  if (url.startsWith(`${PROTOCOL}://`)) {
    handleAuthCallback(url)
  }
})
