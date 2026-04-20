import { ipcMain } from 'electron'
import type { BackendHealth, SessionPreview, CreateSessionInput } from '../shared/backend'

const PY_BACKEND_URL = process.env.PY_BACKEND_URL ?? 'http://127.0.0.1:8000'

async function callPythonApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PY_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Python backend error (${response.status}): ${errorText}`)
  }

  return (await response.json()) as T
}

export function registerBackendIpc(): void {
  ipcMain.handle('backend:health', async (): Promise<BackendHealth> => {
    try {
      return await callPythonApi<BackendHealth>('/health')
    } catch {
      return {
        ok: false,
        service: 'posture-backend',
        timestampIso: new Date().toISOString()
      }
    }
  })

  ipcMain.handle('backend:sessions:list', async (): Promise<SessionPreview[]> => {
    return callPythonApi<SessionPreview[]>('/sessions')
  })

  ipcMain.handle(
    'backend:sessions:create',
    async (_event, payload: CreateSessionInput): Promise<SessionPreview> => {
      if (!payload.durationSeconds || payload.durationSeconds <= 0) {
        throw new Error('Invalid duration')
      }
      if (!payload.endedAtIso) {
        throw new Error('Missing endedAtIso')
      }

      return callPythonApi<SessionPreview>('/sessions/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  )
}
