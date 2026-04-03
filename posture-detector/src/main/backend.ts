import { ipcMain } from 'electron'
import type { BackendHealth, SessionPreview } from '../shared/backend'

export function registerBackendIpc(): void {
  // First backend slice: health + placeholder sessions list.
  // TODO: Back this with real persistence in a later milestone.

  ipcMain.handle('backend:health', (): BackendHealth => ({
    ok: true,
    service: 'posture-backend',
    timestampIso: new Date().toISOString()
  }))

  ipcMain.handle('backend:sessions:list', (): SessionPreview[] => {
    return []
  })
}
