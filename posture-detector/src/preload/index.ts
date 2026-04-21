import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { BackendApi } from '../shared/backend'

import type { CreateSessionInput, PostureSettings } from '../shared/backend'

// Custom APIs for renderer
const api: BackendApi = {
  health: () => electronAPI.ipcRenderer.invoke('backend:health'),
  listSessions: () => electronAPI.ipcRenderer.invoke('backend:sessions:list'),
  createSession: (payload: CreateSessionInput) => electronAPI.ipcRenderer.invoke('backend:sessions:create', payload),
  getSettings: () => electronAPI.ipcRenderer.invoke('backend:settings:get'),
  updateSettings: (settings: PostureSettings) => electronAPI.ipcRenderer.invoke('backend:settings:update', settings)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
