type ControlBarProps = {
  isRunning: boolean
  onStart: () => void
  onPause: () => void
  onReset: () => void
}

function ControlBar({ isRunning, onStart, onPause, onReset }: ControlBarProps): React.JSX.Element {
  return (
    <section className="card controls">
      <button onClick={onStart} disabled={isRunning}>
        Start
      </button>
      <button onClick={onPause} disabled={!isRunning}>
        Pause
      </button>
      <button onClick={onReset}>Reset</button>
      <button>Settings</button>
    </section>
  )
}

export default ControlBar
