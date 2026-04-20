type SettingsPanelProps = {
  notificationsEnabled: boolean
  cameraEnabled: boolean
  onToggleNotifications: () => void
  onToggleCamera: () => void
}

function SettingsPanel({
  notificationsEnabled,
  cameraEnabled,
  onToggleNotifications,
  onToggleCamera
}: SettingsPanelProps): React.JSX.Element {
  return (
    <section className="card">
      <h2>Settings</h2>

      <div className="settings-grid">
        <div className="setting-row">
          <div>
            <h3>Notifications</h3>
            <p>Placeholder toggle for future reminder notifications.</p>
          </div>
          <button onClick={onToggleNotifications}>{notificationsEnabled ? 'On' : 'Off'}</button>
        </div>

        <div className="setting-row">
          <div>
            <h3>Camera</h3>
            <p>Enable or disable the camera preview panel.</p>
          </div>
          <button onClick={onToggleCamera}>{cameraEnabled ? 'On' : 'Off'}</button>
        </div>
      </div>
    </section>
  )
}

export default SettingsPanel
