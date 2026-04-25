type ControlBarProps = {
  isRunning: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onToggleSettings: () => void
}

function ControlBar({
  isRunning,
  onStart,
  onPause,
  onReset,
  onToggleSettings
}: ControlBarProps): React.JSX.Element {
  return (
    <section className="card controls">
      <button onClick={onStart} disabled={isRunning} title="Start a new session">
        Start
      </button>
      <button onClick={onPause} disabled={!isRunning} title="Pause the current session">
        Pause
      </button>
      <button onClick={onReset} title="Reset the timer and session">
        Reset
      </button>
      <button onClick={onToggleSettings} title="Open settings">
        Settings
      </button>
    </section>
  )
}

export default ControlBar
