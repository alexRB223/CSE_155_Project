import type { PostureState } from './CameraPanel'

type SessionSummaryPanelProps = {
  seconds: number
  isRunning: boolean
  postureState: PostureState
  postureConfidence: number
  cameraEnabled: boolean
  notificationsEnabled: boolean
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  return [hours, minutes, secs].map((value) => value.toString().padStart(2, '0')).join(':')
}

function postureLabel(state: PostureState): string {
  if (state === 'good') return 'Good'
  if (state === 'slouching') return 'Slouching'
  if (state === 'no-person') return 'No Person'
  if (state === 'error') return 'Error'
  return 'Analyzing'
}

function postureTone(state: PostureState): 'good' | 'bad' | 'pending' {
  if (state === 'good') return 'good'
  if (state === 'slouching' || state === 'error') return 'bad'
  return 'pending'
}

function SessionSummaryPanel({
  seconds,
  isRunning,
  postureState,
  postureConfidence,
  cameraEnabled,
  notificationsEnabled
}: SessionSummaryPanelProps): React.JSX.Element {
  const tone = postureTone(postureState)

  return (
    <section className="card">
      <h2>Session Summary</h2>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Session</span>
          <span className="summary-value">{isRunning ? 'Running' : 'Paused'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Elapsed</span>
          <span className="summary-value">{formatTime(seconds)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Posture</span>
          <span className={`summary-value summary-tone-${tone}`}>{postureLabel(postureState)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Confidence</span>
          <span className="summary-value">{Math.round(postureConfidence * 100)}%</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Camera</span>
          <span className="summary-value">{cameraEnabled ? 'On' : 'Off'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Alerts</span>
          <span className="summary-value">{notificationsEnabled ? 'On' : 'Off'}</span>
        </div>
      </div>
    </section>
  )
}

export default SessionSummaryPanel