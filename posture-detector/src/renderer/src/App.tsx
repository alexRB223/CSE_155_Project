import { useCallback, useEffect, useState } from 'react'
import CameraPanel, { type PostureState } from './components/CameraPanel'
import PostureStatusCard from './components/PostureStatusCard'
import SessionTimer from './components/SessionTimer'
import ReminderBanner from './components/ReminderBanner'
import ControlBar from './components/ControlBar'
import './assets/main.css'

function App(): React.JSX.Element {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [backendStatus, setBackendStatus] = useState('Checking backend...')
  const [postureState, setPostureState] = useState<PostureState>('loading')
  const [postureConfidence, setPostureConfidence] = useState(0)
  const [postureNote, setPostureNote] = useState('Starting live posture analysis...')

  useEffect(() => {
    if (!isRunning) return

    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    let active = true

    const checkBackend = async (): Promise<void> => {
      try {
        const health = await window.api.health()

        if (!active) return

        if (health.ok) {
          setBackendStatus('Backend connected')
          window.clearInterval(interval)
        } else {
          setBackendStatus('Backend unavailable')
        }
      } catch {
        if (active) {
          setBackendStatus('Backend unavailable')
        }
      }
    }

    const interval = window.setInterval(() => {
      void checkBackend()
    }, 2000)

    void checkBackend()

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])


  const handleStart = (): void => {
    setIsRunning(true)
  }

  const handlePause = (): void => {
    setIsRunning(false)
  }

  const handleReset = (): void => {
    setIsRunning(false)
    setSeconds(0)
  }

  const handlePostureUpdate = useCallback((state: PostureState, confidence: number, note: string): void => {
    setPostureState(state)
    setPostureConfidence(confidence)
    setPostureNote(note)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Posture Study Companion</h1>
        <p>Desktop dashboard prototype for posture monitoring during study sessions.</p>
        <p className="backend-status">{backendStatus}</p>
      </header>

      <main className="dashboard">
        <div className="top-grid">
          <CameraPanel onPostureUpdate={handlePostureUpdate} />
          <div className="side-grid">
            <PostureStatusCard
              state={postureState}
              confidence={postureConfidence}
              note={postureNote}
            />
            <SessionTimer seconds={seconds} />
          </div>
        </div>

        <ReminderBanner />

        <ControlBar
          isRunning={isRunning}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
        />
      </main>
    </div>
  )
}

export default App
