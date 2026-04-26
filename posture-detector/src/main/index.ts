import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerBackendIpc } from './backend'
import { spawn, ChildProcess } from 'child_process'
import { getSettings, updateSettings, deleteSettings } from './settings'
import type { PostureSettings } from '../shared/backend'

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

  registerBackendIpc()
  startPython()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
  stopPython()
})
