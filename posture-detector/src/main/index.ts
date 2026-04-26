import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerBackendIpc } from './backend'
import { spawn, ChildProcess } from 'child_process'
import { getSettings, updateSettings, deleteSettings } from './settings'
import type { PostureSettings } from '../shared/backend'

let pythonProcess: ChildProcess | null = null
let overlayWindow: BrowserWindow | null = null

function startPython(): void {
  if (pythonProcess) return

  pythonProcess = spawn('python', ['-u', 'python/main.py'], {
    windowsHide: true,
    stdio: 'pipe'
  })

  pythonProcess.stdout?.on('data', (data) => {
    console.log(`[py] ${data}`)
  })

  pythonProcess.stderr?.on('data', (data) => {
    console.error(`[py-err] ${data}`)
  })

  pythonProcess.on('close', () => {
    pythonProcess = null
  })
}

function stopPython(): void {
  if (!pythonProcess) return

  if (process.platform === 'win32' && pythonProcess.pid) {
    spawn('taskkill', ['/PID', String(pythonProcess.pid), '/T', '/F'])
    console.log(`win32: Killing Python with PID ${pythonProcess.pid}`)
  } else {
    pythonProcess.kill('SIGTERM')
    console.log(`Not win32: Killing with SIGTERM`)
  }

  pythonProcess = null
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createOverlayWindow(): void {
  if (overlayWindow) return

  const { workArea } = screen.getPrimaryDisplay()
  const width = 320
  const height = 120
  const margin = 24

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - margin,
    y: workArea.y + margin,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      sandbox: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const overlayHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            overflow: hidden;
            font-family: Arial, sans-serif;
          }
          body {
            display: flex;
            align-items: stretch;
            justify-content: stretch;
          }
          .overlay-card {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 16px 18px;
            border-radius: 18px;
            border: 1px solid rgba(251, 113, 133, 0.4);
            background: rgba(69, 10, 10, 0.92);
            color: #ffe4e6;
          }
          .overlay-title {
            margin: 0 0 10px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #fecdd3;
          }
          .overlay-message {
            margin: 0 0 8px;
            font-size: 24px;
            font-weight: 700;
            line-height: 1.1;
          }
          .overlay-note {
            margin: 0;
            font-size: 13px;
            color: #fecdd3;
          }
        </style>
      </head>
      <body>
        <div class="overlay-card">
          <p class="overlay-title">Posture Alert</p>
          <p class="overlay-message">Straighten up</p>
          <p class="overlay-note">Sit back and lift your shoulders into position.</p>
        </div>
      </body>
    </html>
  `

  void overlayWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(overlayHtml)}`)

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function setOverlayWindowVisible(visible: boolean): boolean {
  if (!overlayWindow) {
    createOverlayWindow()
  }

  if (!overlayWindow) {
    return false
  }

  if (visible) {
    overlayWindow.showInactive()
  } else {
    overlayWindow.hide()
  }

  return overlayWindow.isVisible()
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('backend:settings:get', () => getSettings())
  ipcMain.handle('backend:settings:update', (_event, settings: PostureSettings) =>
    updateSettings(settings)
  )
  ipcMain.handle('backend:settings:delete', () => deleteSettings())
  ipcMain.handle('overlay:get-visible', () => overlayWindow?.isVisible() ?? false)
  ipcMain.handle('overlay:set-visible', (_event, visible: boolean) => setOverlayWindowVisible(visible))

  registerBackendIpc()
  startPython()
  createWindow()
  createOverlayWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
  stopPython()
})
