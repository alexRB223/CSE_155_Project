import { useCallback, useEffect, useRef, useState } from 'react'
import CameraPanel, { type PostureState } from './components/CameraPanel'
import PostureStatusCard from './components/PostureStatusCard'
import SessionSummaryPanel from './components/SessionSummaryPanel'
import ReminderBanner from './components/ReminderBanner'
import ControlBar from './components/ControlBar'
import SettingsPanel from './components/SettingsPanel'
import './assets/main.css'

function App(): React.JSX.Element {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [backendStatus, setBackendStatus] = useState('Checking backend...')
  const [postureState, setPostureState] = useState<PostureState>('loading')
  const [postureConfidence, setPostureConfidence] = useState(0)
  const [postureNote, setPostureNote] = useState('Starting live posture analysis...')
  const [showSettings, setShowSettings] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)

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
    void primeAlertAudio()
    setIsRunning(true)
  }

  const handlePause = (): void => {
    setIsRunning(false)
  }

  const handleReset = (): void => {
    setIsRunning(false)
    setSeconds(0)
  }

  const handleToggleSettings = (): void => {
    setShowSettings((prev) => !prev)
  }

  const handleToggleNotifications = (): void => {
    setNotificationsEnabled((prev) => !prev)
  }

  const handleToggleCamera = (): void => {
    setCameraEnabled((prev) => !prev)
  }

  const getAudioContext = useCallback((): AudioContext | null => {
    if (audioContextRef.current) {
      return audioContextRef.current
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext

    if (!AudioContextCtor) {
      return null
    }

    audioContextRef.current = new AudioContextCtor()
    return audioContextRef.current
  }, [])

  const primeAlertAudio = useCallback(async (): Promise<void> => {
    const context = getAudioContext()
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      await context.resume()
    }
  }, [getAudioContext])

  const handleToggleSoundAlerts = (): void => {
    setSoundAlertsEnabled((prev) => {
      const next = !prev
      if (next) {
        void primeAlertAudio()
      }
      return next
    })
  }

  const playAlertTone = useCallback(async (): Promise<void> => {
    const context = getAudioContext()
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      await context.resume()
    }

    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(1046, context.currentTime)
    gainNode.gain.setValueAtTime(0.0001, context.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.03)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start()
    oscillator.stop(context.currentTime + 0.36)
  }, [getAudioContext])

  useEffect(() => {
    if (!soundAlertsEnabled || !cameraEnabled || postureState !== 'slouching') {
      return
    }

    // Beep immediately when entering/being in slouching state,
    // then continue at a gentle interval until posture improves.
    void playAlertTone()

    const intervalId = window.setInterval(() => {
      void playAlertTone()
    }, 4000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [cameraEnabled, playAlertTone, postureState, soundAlertsEnabled])

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  const handlePostureUpdate = useCallback(
    (state: PostureState, confidence: number, note: string): void => {
      setPostureState(state)
      setPostureConfidence(confidence)
      setPostureNote(note)
    },
    []
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Posture Study Companion</h1>
        <p>Desktop dashboard prototype for posture monitoring during study sessions.</p>
        <p className="backend-status">{backendStatus}</p>
      </header>

      <main className="dashboard">
        <div className="top-grid">
          <CameraPanel onPostureUpdate={handlePostureUpdate} enabled={cameraEnabled} />
          <div className="side-grid">
            <PostureStatusCard
              state={postureState}
              confidence={postureConfidence}
              note={postureNote}
            />
            <SessionSummaryPanel
              seconds={seconds}
              isRunning={isRunning}
              postureState={postureState}
              postureConfidence={postureConfidence}
              cameraEnabled={cameraEnabled}
              notificationsEnabled={notificationsEnabled}
            />
          </div>
        </div>

        <ReminderBanner />

        <ControlBar
          isRunning={isRunning}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onToggleSettings={handleToggleSettings}
        />
        {showSettings && (
          <SettingsPanel
            notificationsEnabled={notificationsEnabled}
            soundAlertsEnabled={soundAlertsEnabled}
            cameraEnabled={cameraEnabled}
            onToggleNotifications={handleToggleNotifications}
            onToggleSoundAlerts={handleToggleSoundAlerts}
            onToggleCamera={handleToggleCamera}
          />
        )}
      </main>
    </div>
  )
}

export default App
