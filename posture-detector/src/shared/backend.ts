export interface BackendHealth {
  ok: boolean
  service: 'posture-backend'
  timestampIso: string
}

export interface SessionPreview {
  id: string
  durationSeconds: number
  endedAtIso: string
}

export interface CreateSessionInput {
  durationSeconds: number
  endedAtIso: string
}

export interface BackendApi {
  health: () => Promise<BackendHealth>
  listSessions: () => Promise<SessionPreview[]>
  createSession: (payload: CreateSessionInput) => Promise<SessionPreview>
}
