import { BrowserWindow, ipcMain, screen } from 'electron'

let overlayWindow: BrowserWindow | null = null

export function createOverlayWindow(): void {
  if (overlayWindow) return

  const { workArea } = screen.getPrimaryDisplay()
  const width = 320
  const height = 80
  const margin = 25

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
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

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
            width: 98%;
            height: 98%;
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
            font-size: 20px;
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
        </div>
      </body>
    </html>
  `

  void overlayWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(overlayHtml)}`)

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

export function setOverlayWindowVisible(visible: boolean): boolean {
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

export function isOverlayWindowVisible(): boolean {
  return overlayWindow?.isVisible() ?? false
}

export function registerOverlayIpc(): void {
  ipcMain.handle('overlay:get-visible', () => isOverlayWindowVisible())
  ipcMain.handle('overlay:set-visible', (_event, visible: boolean) => setOverlayWindowVisible(visible))
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
}

export function destroyOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
  }
  overlayWindow = null
}