import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'
import { registerBackendIpc } from './backend'
import { getSettings, updateSettings, deleteSettings } from './settings'
import type { PostureSettings } from '../shared/backend'
import {
  createOverlayWindow,
  registerOverlayIpc,
  closeOverlayWindow,
  destroyOverlayWindow
} from './overlay'

let pythonProcess: ChildProcess | null = null

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
    console.log('Not win32: Killing with SIGTERM')
  }

  pythonProcess = null
}

function createWindow(): void {
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

  mainWindow.on('closed', () => {
    closeOverlayWindow()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('backend:settings:get', () => getSettings())
  ipcMain.handle('backend:settings:update', (_event, settings: PostureSettings) =>
    updateSettings(settings)
  )
  ipcMain.handle('backend:settings:delete', () => deleteSettings())

  registerOverlayIpc()
  registerBackendIpc()

  startPython()
  createWindow()
  createOverlayWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopPython()
  destroyOverlayWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})