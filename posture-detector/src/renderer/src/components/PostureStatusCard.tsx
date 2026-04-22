import type { PostureState } from './CameraPanel'

interface PostureStatusCardProps {
  state: PostureState
  confidence: number
  note: string
  visualAlertsEnabled: boolean
}

function PostureStatusCard({
  state,
  confidence,
  note,
  visualAlertsEnabled
}: PostureStatusCardProps): React.JSX.Element {
  const alertsDisabled = !visualAlertsEnabled

  const label =
    alertsDisabled
      ? 'Visual alerts are off'
      : state === 'good'
      ? 'Good posture'
      : state === 'slouching'
        ? 'Slouching detected'
        : state === 'no-person'
          ? 'No person detected'
          : state === 'error'
            ? 'Camera/model error'
            : 'Analyzing posture...'

  const statusClass =
    alertsDisabled
      ? 'pending'
      : state === 'good'
      ? 'good'
      : state === 'slouching'
        ? 'bad'
        : state === 'error'
          ? 'error'
          : 'pending'

  const detailText = alertsDisabled ? 'Turn on Visual Alerts in Settings to show live warning text.' : note

  return (
    <section className="card">
      <h2>Posture Status</h2>
      <p className={`status ${statusClass}`}>{label}</p>
      <p>{detailText}</p>
      <small>Confidence: {Math.round(confidence * 100)}%</small>
    </section>
  )
}

export default PostureStatusCard
