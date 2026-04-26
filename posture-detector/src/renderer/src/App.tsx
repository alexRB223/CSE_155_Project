import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import CameraPanel, { type PostureState } from './components/CameraPanel'
import PostureStatusCard from './components/PostureStatusCard'
import SessionSummaryPanel from './components/SessionSummaryPanel'
import ReminderBanner from './components/ReminderBanner'
import ControlBar from './components/ControlBar'
import SettingsPanel from './components/SettingsPanel'
import type { CreateUserInput, LoginUserInput, UserAccount } from '../../shared/backend'
import './assets/main.css'

const DEFAULT_GOAL_SECONDS = 60
const GOAL_MIN_SECONDS = 30
const GOAL_MAX_SECONDS = 600
const GOAL_STEP_SECONDS = 30
const DEFAULT_REMINDER = 'Keep your shoulders relaxed and sit upright.'

type Theme = 'dark' | 'light'
type AuthMode = 'login' | 'signup'

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
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [authError, setAuthError] = useState('')
  const [authPending, setAuthPending] = useState(false)
  const [loginForm, setLoginForm] = useState<LoginUserInput>({
    username: '',
    password: ''
  })
  const [signupForm, setSignupForm] = useState<CreateUserInput>({
    username: '',
    password: ''
  })
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [postureState, setPostureState] = useState<PostureState>('loading')
  const [postureConfidence, setPostureConfidence] = useState(0)
  const [postureNote, setPostureNote] = useState('Starting live posture analysis...')
  const [showSettings, setShowSettings] = useState(false)
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

  const handleLogout = (): void => {
    handleReset()
    setShowSettings(false)
    setAuthError('')
    setAuthMode('login')
    setCurrentUser(null)
  }

  const handleToggleSettings = (): void => {
    setShowSettings((prev) => !prev)
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

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setAuthError('')
    setAuthPending(true)

    try {
      const user =
        authMode === 'login'
          ? await window.api.login(loginForm)
          : await window.api.signup(signupForm)

      setCurrentUser(user)
    } catch (error) {
      const fallbackMessage =
        authMode === 'login' ? 'Unable to log in right now.' : 'Unable to create account right now.'

      if (error instanceof Error && error.message) {
        setAuthError(error.message)
      } else {
        setAuthError(fallbackMessage)
      }
    } finally {
      setAuthPending(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="app-shell auth-shell">
        <section className="auth-card">
          <div className="auth-copy">
            <p className="auth-eyebrow">Posture Study Companion</p>
            <h1>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p>
              {authMode === 'login'
                ? 'Log in to keep your posture sessions and account data tied together.'
                : 'Start with a simple account so we can connect future posture history and settings to you.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-mode-toggle" aria-label="Authentication mode">
              <button
                className={`auth-mode-btn ${authMode === 'login' ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setAuthError('')
                  setAuthMode('login')
                }}
              >
                Log In
              </button>
              <button
                className={`auth-mode-btn ${authMode === 'signup' ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  setAuthError('')
                  setAuthMode('signup')
                }}
              >
                Create Account
              </button>
            </div>

            <p className="auth-mode-note">
              {authMode === 'login'
                ? 'Use an existing username and password.'
                : 'This creates a brand new account.'}
            </p>

            <label className="auth-field">
              <span>Username</span>
              <input
                type="text"
                value={authMode === 'login' ? loginForm.username : signupForm.username}
                onChange={(event) => {
                  const { value } = event.target
                  if (authMode === 'login') {
                    setLoginForm((prev) => ({ ...prev, username: value }))
                    return
                  }
                  setSignupForm((prev) => ({ ...prev, username: value }))
                }}
                placeholder="studybuddy"
                minLength={3}
                maxLength={50}
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={authMode === 'login' ? loginForm.password : signupForm.password}
                onChange={(event) => {
                  const { value } = event.target
                  if (authMode === 'login') {
                    setLoginForm((prev) => ({ ...prev, password: value }))
                    return
                  }
                  setSignupForm((prev) => ({ ...prev, password: value }))
                }}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
                required
              />
            </label>

            {authError && <p className="auth-error">{authError}</p>}

            <button className="auth-submit" type="submit" disabled={authPending}>
              {authPending
                ? authMode === 'login'
                  ? 'Logging in...'
                  : 'Creating account...'
                : authMode === 'login'
                  ? 'Log In to Existing Account'
                  : 'Create New Account'}
            </button>

            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthError('')
                setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
              }}
            >
              {authMode === 'login'
                ? 'Need a new account? Switch to sign up'
                : 'Already have an account? Switch to log in'}
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
          <div>
            <h1>Posture Study Companion</h1>
            <p>Desktop dashboard prototype for posture monitoring during study sessions.</p>
            <p>Signed in as {currentUser.username}</p>
          </div>
          <button className="header-action-btn" type="button" onClick={handleLogout}>
            Log Out
          </button>
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
          onToggleSettings={handleToggleSettings}
        />
        {showSettings && (
          <SettingsPanel
            notificationsEnabled={notificationsEnabled}
            soundAlertsEnabled={soundAlertsEnabled}
            cameraEnabled={cameraEnabled}
            goalSeconds={goalSeconds}
            theme={theme}
            onToggleNotifications={handleToggleNotifications}
            onToggleSoundAlerts={handleToggleSoundAlerts}
            onToggleCamera={handleToggleCamera}
            onChangeGoal={handleChangeGoal}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </main>
    </div>
  )
}

export default App
