import { ipcMain } from 'electron'
import type {
  BackendHealth,
  SessionPreview,
  CreateSessionInput,
  CreateUserInput,
  LoginUserInput,
  UserAccount
} from '../shared/backend'

const PY_BACKEND_URL = process.env.PY_BACKEND_URL ?? 'http://127.0.0.1:8000'

function getFriendlyBackendErrorMessage(status: number, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as { detail?: unknown }
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
      return parsed.detail
    }
  } catch {
    // Fall back to generic messages when the backend response is not JSON.
  }

  if (status === 401) {
    return 'Invalid username or password'
  }

  if (status === 409) {
    return 'Username is already in use'
  }

  if (status >= 500) {
    return 'Backend error. Please try again.'
  }

  return 'Request failed. Please check your input and try again.'
}

async function callPythonApi<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${PY_BACKEND_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    })
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` (${error.message})` : ''
    throw new Error(`Python backend is unavailable at ${PY_BACKEND_URL}${detail}`)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(getFriendlyBackendErrorMessage(response.status, errorText))
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

  ipcMain.handle('backend:users:signup', async (_event, payload: CreateUserInput): Promise<UserAccount> => {
    if (!payload.username) {
      throw new Error('Missing username')
    }
    if (!payload.password) {
      throw new Error('Missing password')
    }

    return callPythonApi<UserAccount>('/users/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  })

  ipcMain.handle('backend:users:login', async (_event, payload: LoginUserInput): Promise<UserAccount> => {
    if (!payload.username) {
      throw new Error('Missing username')
    }
    if (!payload.password) {
      throw new Error('Missing password')
    }

    return callPythonApi<UserAccount>('/users/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  })
}
