import { ipcMain, app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BackendHealth, SessionPreview, CreateSessionInput } from '../shared/backend'

const STORE_FILE = 'posture-sessions.json'

function getStorePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

async function readSessions(): Promise<SessionPreview[]> {
  try {
    const data = await fs.readFile(getStorePath(), 'utf8')
    return JSON.parse(data) as SessionPreview[]
  } catch {
    return []
  }
}

async function writeSessions(sessions: SessionPreview[]): Promise<void> {
  const path = getStorePath()
  await fs.writeFile(path, JSON.stringify(sessions, null, 2), 'utf8')
}

export function registerBackendIpc(): void {
  ipcMain.handle('backend:health', (): BackendHealth => ({
    ok: true,
    service: 'posture-backend',
    timestampIso: new Date().toISOString()
  }))

  ipcMain.handle('backend:sessions:list', async (): Promise<SessionPreview[]> => {
    const sessions = await readSessions()
    return sessions.sort((a, b) => new Date(b.endedAtIso).getTime() - new Date(a.endedAtIso).getTime())
  })

  ipcMain.handle('backend:sessions:create', async (_event, payload: CreateSessionInput): Promise<SessionPreview> => {
    if (!payload.durationSeconds || payload.durationSeconds < 0) {
      throw new Error('Invalid duration')
    }
    if (!payload.endedAtIso) {
      throw new Error('Missing endedAtIso')
    }

    const newSession: SessionPreview = {
      id: randomUUID(),
      durationSeconds: payload.durationSeconds,
      endedAtIso: payload.endedAtIso
    }

    const sessions = await readSessions()
    sessions.unshift(newSession)
    await writeSessions(sessions.slice(0, 500))

    return newSession
  })
}
