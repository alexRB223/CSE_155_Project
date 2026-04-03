type SessionTimerProps = {
  seconds: number
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  return [hours, minutes, secs].map((value) => value.toString().padStart(2, '0')).join(':')
}

function SessionTimer({ seconds }: SessionTimerProps): React.JSX.Element {
  return (
    <section className="card">
      <h2>Session Timer</h2>
      <p className="timer">{formatTime(seconds)}</p>
    </section>
  )
}

export default SessionTimer
