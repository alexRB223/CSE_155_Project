import { ElectronAPI } from '@electron-toolkit/preload'
import type { BackendApi } from '../shared/backend'

declare global {
  interface Window {
    electron: ElectronAPI
    api: BackendApi
  }
}
