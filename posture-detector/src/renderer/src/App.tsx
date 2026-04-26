import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import CameraPanel, { type PostureState } from './components/CameraPanel'
import PostureStatusCard from './components/PostureStatusCard'
import SessionSummaryPanel from './components/SessionSummaryPanel'
import ReminderBanner from './components/ReminderBanner'
import ControlBar from './components/ControlBar'
import SettingsPanel from './components/SettingsPanel'
import './assets/main.css'

const DEFAULT_GOAL_SECONDS = 60
const GOAL_MIN_SECONDS = 30
const GOAL_MAX_SECONDS = 600
const GOAL_STEP_SECONDS = 30
const DEFAULT_REMINDER = 'Keep your shoulders relaxed and sit upright.'

type Theme = 'dark' | 'light'

function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem('postureTheme')
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // Ignore storage errors (e.g., disabled storage in hardened environments).
  }

  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches
  return prefersLight ? 'light' : 'dark'
}

function getOrCreateAudioContext(ref: MutableRefObject<AudioContext | null>): AudioContext | null {
  if (ref.current) {
    return ref.current
  }

  const AudioContextCtor =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext

  if (!AudioContextCtor) {
    return null
  }

  ref.current = new AudioContextCtor()
  return ref.current
}

function normalizeGoalSeconds(value: number): number {
  const clamped = Math.min(GOAL_MAX_SECONDS, Math.max(GOAL_MIN_SECONDS, value))
  return Math.round(clamped / GOAL_STEP_SECONDS) * GOAL_STEP_SECONDS
}

function App(): React.JSX.Element {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [backendStatus, setBackendStatus] = useState('Checking backend...')
  const [postureState, setPostureState] = useState<PostureState>('loading')
  const [postureConfidence, setPostureConfidence] = useState(0)
  const [postureNote, setPostureNote] = useState('Starting live posture analysis...')
  const [overlayAlertsEnabled, setOverlayAlertsEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [goalSeconds, setGoalSeconds] = useState(() => {
    try {
      const stored = window.localStorage.getItem('postureGoalSeconds')
      if (!stored) return DEFAULT_GOAL_SECONDS
      const parsed = Number(stored)
      if (!Number.isFinite(parsed)) return DEFAULT_GOAL_SECONDS
      return normalizeGoalSeconds(parsed)
    } catch {
      return DEFAULT_GOAL_SECONDS
    }
  })
  const [goodStreak, setGoodStreak] = useState(0)
  const [slouchStreak, setSlouchStreak] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem('postureTheme', theme)
    } catch {
      // Ignore storage errors (e.g., disabled storage in hardened environments).
    }
  }, [theme])

  useEffect(() => {
    try {
      window.localStorage.setItem('postureGoalSeconds', String(goalSeconds))
    } catch {
      // Ignore storage errors (e.g., disabled storage in hardened environments).
    }
  }, [goalSeconds])

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

  useEffect(() => {
    if (!isRunning) return

    const interval = window.setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isRunning])

  const reminderMessage =
    goodStreak >= goalSeconds
      ? 'Great job! You reached your posture goal.'
      : slouchStreak >= 5
        ? 'Fix your posture! Sit upright.'
        : DEFAULT_REMINDER

  useEffect(() => {
    if (!isRunning || !cameraEnabled) return

    const interval = window.setInterval(() => {
      if (postureState === 'good') {
        setGoodStreak((prev) => prev + 1)
        setSlouchStreak(0)
        return
      }

      if (postureState === 'slouching') {
        setSlouchStreak((prev) => prev + 1)
        setGoodStreak(0)
        return
      }

      setGoodStreak(0)
      setSlouchStreak(0)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [cameraEnabled, isRunning, postureState])

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
    setGoodStreak(0)
    setSlouchStreak(0)
  }

  const handleToggleOverlay = async (): Promise<void> => {
    try {
      const nextEnabled = !overlayAlertsEnabled
      setOverlayAlertsEnabled(nextEnabled)
      if (!nextEnabled) {
        await window.electron.ipcRenderer.invoke('overlay:set-visible', false)
      }
    } catch {
      setOverlayAlertsEnabled(false)
    }
  }

  const handleToggleTheme = (): void => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleToggleNotifications = (): void => {
    setNotificationsEnabled((prev) => !prev)
  }

  const handleToggleCamera = (): void => {
    setCameraEnabled((prev) => {
      const next = !prev
      if (!next) {
        setGoodStreak(0)
        setSlouchStreak(0)
      }
      return next
    })
  }

  const handleChangeGoal = (value: number): void => {
    if (!Number.isFinite(value)) {
      return
    }

    setGoalSeconds(normalizeGoalSeconds(value))
  }

  async function primeAlertAudio(): Promise<void> {
    const context = getOrCreateAudioContext(audioContextRef)
    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      await context.resume()
    }
  }

  const handleToggleSoundAlerts = (): void => {
    setSoundAlertsEnabled((prev) => {
      const next = !prev
      if (next) {
        void primeAlertAudio()
      }
      return next
    })
  }

  useEffect(() => {
    if (!soundAlertsEnabled || !cameraEnabled || postureState !== 'slouching') {
      return
    }

    const playAlertTone = async (): Promise<void> => {
      const context = getOrCreateAudioContext(audioContextRef)
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
  }, [cameraEnabled, postureState, soundAlertsEnabled])

  useEffect(() => {
    const shouldShowOverlay =
      overlayAlertsEnabled &&
      cameraEnabled &&
      postureState === 'slouching'

    void window.electron.ipcRenderer.invoke('overlay:set-visible', shouldShowOverlay)
  }, [cameraEnabled, overlayAlertsEnabled, postureState])

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
        <div className="app-header-row">
          <div>
            <h1>Posture Study Companion</h1>
            <p>Desktop dashboard prototype for posture monitoring during study sessions.</p>
            <p className="backend-status">{backendStatus}</p>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <div className="top-grid">
          <CameraPanel onPostureUpdate={handlePostureUpdate} enabled={cameraEnabled} />
          <div className="side-grid">
            <PostureStatusCard
              state={postureState}
              confidence={postureConfidence}
              note={postureNote}
              visualAlertsEnabled={notificationsEnabled}
            />
            <SessionSummaryPanel
              seconds={seconds}
              isRunning={isRunning}
              postureState={postureState}
              postureConfidence={postureConfidence}
              cameraEnabled={cameraEnabled}
              notificationsEnabled={notificationsEnabled}
              goalSeconds={goalSeconds}
              goodStreak={goodStreak}
            />
          </div>
        </div>

        {notificationsEnabled && <ReminderBanner message={reminderMessage} />}

        <ControlBar
          isRunning={isRunning}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
        />
        <SettingsPanel
          overlayAlertsEnabled={overlayAlertsEnabled}
          notificationsEnabled={notificationsEnabled}
          soundAlertsEnabled={soundAlertsEnabled}
          cameraEnabled={cameraEnabled}
          goalSeconds={goalSeconds}
          theme={theme}
          onToggleOverlay={handleToggleOverlay}
          onToggleNotifications={handleToggleNotifications}
          onToggleSoundAlerts={handleToggleSoundAlerts}
          onToggleCamera={handleToggleCamera}
          onChangeGoal={handleChangeGoal}
          onToggleTheme={handleToggleTheme}
        />
      </main>
    </div>
  )
}

export default App
