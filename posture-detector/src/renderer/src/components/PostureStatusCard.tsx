import type { PostureState } from './CameraPanel'

interface PostureStatusCardProps {
  state: PostureState
  confidence: number
  note: string
}

function PostureStatusCard({ state, confidence, note }: PostureStatusCardProps): React.JSX.Element {
  const label =
    state === 'good'
      ? 'Good posture'
      : state === 'slouching'
        ? 'Slouching detected'
        : state === 'no-person'
          ? 'No person detected'
          : state === 'error'
            ? 'Camera/model error'
            : 'Analyzing posture...'

  const statusClass =
    state === 'good'
      ? 'good'
      : state === 'slouching'
        ? 'bad'
        : state === 'error'
          ? 'error'
          : 'pending'

  return (
    <section className="card">
      <h2>Posture Status</h2>
      <p className={`status ${statusClass}`}>{label}</p>
      <p>{note}</p>
      <small>Confidence: {Math.round(confidence * 100)}%</small>
    </section>
  )
}

export default PostureStatusCard
