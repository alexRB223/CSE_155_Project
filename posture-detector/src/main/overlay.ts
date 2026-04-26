import { BrowserWindow, ipcMain, screen } from 'electron'

let overlayWindow: BrowserWindow | null = null

export function createOverlayWindow(): void {
  if (overlayWindow) return

  const { workArea } = screen.getPrimaryDisplay()
  const width = 320
  const height = 120
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

  const overlayHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      </head>
      <body class="m-0 h-screen w-screen overflow-hidden bg-transparent font-sans">
        <div class="flex h-full w-full items-stretch justify-stretch">
          <div
            class="box-border h-full w-full rounded-[18px] border border-[rgba(251,113,133,0.4)] bg-[rgba(69,10,10,0.92)] px-[18px] py-4 text-rose-100"
          >
            <p class="mb-[10px] text-[12px] font-bold uppercase tracking-[0.12em] text-rose-200">
              Posture Alert
            </p>
            <p class="mb-2 text-[24px] font-bold leading-[1.1] text-rose-100">
              Straighten up
            </p>
            <p class="m-0 text-[13px] text-rose-200">
              Sit back and lift your shoulders into position.
            </p>
          </div>
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