type SettingsPanelProps = {
  notificationsEnabled: boolean
  soundAlertsEnabled: boolean
  cameraEnabled: boolean
  onToggleNotifications: () => void
  onToggleSoundAlerts: () => void
  onToggleCamera: () => void
}

function SettingsPanel({
  notificationsEnabled,
  soundAlertsEnabled,
  cameraEnabled,
  onToggleNotifications,
  onToggleSoundAlerts,
  onToggleCamera
}: SettingsPanelProps): React.JSX.Element {
  return (
    <section className="card">
      <h2>Settings</h2>

      <div className="settings-grid">
        <div className="setting-row">
          <div>
            <h3>Visual Alerts</h3>
            <p>Toggle for Visual reminder notifications.</p>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={notificationsEnabled} onChange={onToggleNotifications} />
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
