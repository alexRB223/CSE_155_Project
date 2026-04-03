import CameraPanel from './components/CameraPanel'
import PostureStatusCard from './components/PostureStatusCard'
import SessionTimer from './components/SessionTimer'
import ReminderBanner from './components/ReminderBanner'
import ControlBar from './components/ControlBar'
import './assets/main.css'

function App(): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Posture Study Companion</h1>
        <p>Desktop dashboard prototype for posture monitoring during study sessions.</p>
      </header>

      <main className="dashboard">
        <div className="top-grid">
          <CameraPanel />
          <div className="side-grid">
            <PostureStatusCard />
            <SessionTimer />
          </div>
        </div>

        <ReminderBanner />
        <ControlBar />
      </main>
    </div>
  )
}

export default App
