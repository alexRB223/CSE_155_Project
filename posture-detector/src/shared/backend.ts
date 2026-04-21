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

export interface PointConfig {
  idealY: number
  tolerance: number
}

export interface PostureSettings {
  shoulders: PointConfig
  ears: PointConfig
}

export interface BackendApi {
  health: () => Promise<BackendHealth>
  listSessions: () => Promise<SessionPreview[]>
  createSession: (payload: CreateSessionInput) => Promise<SessionPreview>
  getSettings: () => Promise<PostureSettings>
  updateSettings: (settings: PostureSettings) => Promise<boolean>
}
