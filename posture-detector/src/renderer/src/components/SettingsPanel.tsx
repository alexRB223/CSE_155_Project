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
  return (
    <section className="card">
      <h2>Settings</h2>

      <div className="settings-grid">
        <div className="setting-row">
          <div>
            <h3>Posture Goal</h3>
            <p>Set how long to maintain good posture (seconds).</p>
          </div>
          <input
            className="setting-number"
            type="number"
            value={goalSeconds}
            onChange={(e) => onChangeGoal(Number(e.target.value))}
            min={10}
            max={600}
          />
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
