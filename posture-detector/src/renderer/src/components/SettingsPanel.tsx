import { useEffect, useRef } from 'react'

type SettingsPanelProps = {
  notificationsEnabled: boolean
  soundAlertsEnabled: boolean
  cameraEnabled: boolean
  goalSeconds: number
  theme: 'dark' | 'light'
  onToggleNotifications: () => void
  onToggleSoundAlerts: () => void
  onToggleCamera: () => void
  onChangeGoal: (value: number) => void
  onToggleTheme: () => void
}

const GOAL_MIN_SECONDS = 30
const GOAL_MAX_SECONDS = 600
const GOAL_STEP_SECONDS = 30
const HOLD_DELAY_MS = 350
const HOLD_REPEAT_MS = 90

function SettingsPanel({
  notificationsEnabled,
  soundAlertsEnabled,
  cameraEnabled,
  goalSeconds,
  theme,
  onToggleNotifications,
  onToggleSoundAlerts,
  onToggleCamera,
  onChangeGoal,
  onToggleTheme
}: SettingsPanelProps): React.JSX.Element {
  const repeatTimeoutRef = useRef<number | null>(null)
  const repeatIntervalRef = useRef<number | null>(null)

  const stopRepeating = (): void => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current)
      repeatTimeoutRef.current = null
    }

    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current)
      repeatIntervalRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopRepeating()
    }
  }, [])

  const changeGoalBy = (delta: number): void => {
    const next = Math.min(GOAL_MAX_SECONDS, Math.max(GOAL_MIN_SECONDS, goalSeconds + delta))
    if (next !== goalSeconds) {
      onChangeGoal(next)
    }
  }

  const beginRepeating = (delta: number): void => {
    stopRepeating()
    changeGoalBy(delta)

    repeatTimeoutRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => {
        changeGoalBy(delta)
      }, HOLD_REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  return (
    <section className="card">
      <h2>Settings</h2>

      <div className="settings-grid">
        <div className="setting-row">
          <div>
            <h3>Posture Goal</h3>
            <p>Choose how long to maintain good posture in 30-second increments.</p>
          </div>
          <div className="goal-stepper" aria-label="Posture goal selector">
            <button
              type="button"
              className="setting-stepper-button"
              onPointerDown={() => beginRepeating(-GOAL_STEP_SECONDS)}
              onPointerUp={stopRepeating}
              onPointerLeave={stopRepeating}
              onPointerCancel={stopRepeating}
              onBlur={stopRepeating}
              aria-label="Decrease posture goal"
            >
              -
            </button>
            <span className="setting-goal-value">{goalSeconds} sec</span>
            <button
              type="button"
              className="setting-stepper-button"
              onPointerDown={() => beginRepeating(GOAL_STEP_SECONDS)}
              onPointerUp={stopRepeating}
              onPointerLeave={stopRepeating}
              onPointerCancel={stopRepeating}
              onBlur={stopRepeating}
              aria-label="Increase posture goal"
            >
              +
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <h3>Theme</h3>
            <p>Switch between dark and light mode.</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={theme === 'light'} onChange={onToggleTheme} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div>
            <h3>Visual Alerts</h3>
            <p>Toggle for Visual reminder notifications.</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={onToggleNotifications}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div>
            <h3>Camera</h3>
            <p>Enable or disable the camera preview panel.</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={cameraEnabled} onChange={onToggleCamera} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-row">
          <div>
            <h3>Sound Alerts</h3>
            <p>Play a short tone when slouching is detected.</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={soundAlertsEnabled} onChange={onToggleSoundAlerts} />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </section>
  )
}

export default SettingsPanel
