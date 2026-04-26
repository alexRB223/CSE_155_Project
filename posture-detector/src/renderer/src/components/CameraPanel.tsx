import { useEffect, useRef, useState } from 'react'
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult
} from '@mediapipe/tasks-vision'
import type { PostureSettings } from '../../../shared/backend'
import PostureSettingsModal from './PostureSettingsModal'

export type PostureState = 'loading' | 'good' | 'slouching' | 'no-person' | 'error'

interface CameraPanelProps {
  onPostureUpdate: (state: PostureState, confidence: number, note: string) => void
  enabled: boolean
}

const DEFAULT_POSTURE_SETTINGS: PostureSettings = {
  shoulders: { idealY: 0.5, tolerance: 0.05 },
  ears: { idealY: 0.35, tolerance: 0.05 }
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const IDX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftEar: 7,
  rightEar: 8
} as const

function avgVisibility(landmarks: NormalizedLandmark[]): number {
  const points = [
    landmarks[IDX.leftShoulder],
    landmarks[IDX.rightShoulder],
    landmarks[IDX.leftEar],
    landmarks[IDX.rightEar]
  ]

  const total = points.reduce((sum, point) => sum + (point?.visibility ?? 0), 0)
  return total / points.length
}

function evaluatePosture(
  result: PoseLandmarkerResult,
  settings: PostureSettings | null
): {
  state: PostureState
  confidence: number
  note: string
} {
  const landmarks = result.landmarks[0]

  if (!landmarks) {
    return {
      state: 'no-person',
      confidence: 0,
      note: 'No person detected. Sit in frame so shoulders are visible.'
    }
  }

  const leftShoulder = landmarks[IDX.leftShoulder]
  const rightShoulder = landmarks[IDX.rightShoulder]
  const leftEar = landmarks[IDX.leftEar]
  const rightEar = landmarks[IDX.rightEar]

  if (!leftShoulder || !rightShoulder || !leftEar || !rightEar) {
    return {
      state: 'no-person',
      confidence: 0,
      note: 'Landmarks are not stable yet.'
    }
  }

  const confidence = avgVisibility(landmarks)

  if (!settings || !settings.shoulders || !settings.ears) {
    return {
      state: 'loading',
      confidence,
      note: 'Posture settings not found, click \n"Posture\u00A0Detection\u00A0Settings" \nto start posture detection.'
    }
  }

  const isOut = (
    pt: NormalizedLandmark,
    config: { idealY: number; tolerance: number }
  ): boolean => {
    return Math.abs(pt.y - config.idealY) > config.tolerance
  }

  const outPoints: string[] = []
  if (isOut(leftShoulder, settings.shoulders)) outPoints.push('Left Shoulder')
  if (isOut(rightShoulder, settings.shoulders)) outPoints.push('Right Shoulder')
  if (isOut(leftEar, settings.ears)) outPoints.push('Left Ear')
  if (isOut(rightEar, settings.ears)) outPoints.push('Right Ear')

  if (outPoints.length > 0) {
    return {
      state: 'slouching',
      confidence,
      note: `Adjust your posture. Keep within bounds for: ${outPoints.join(', ')}`
    }
  }

  return {
    state: 'good',
    confidence,
    note: 'Great alignment. Keep your neck tall and shoulders relaxed.'
  }
}

function CameraPanel({ onPostureUpdate, enabled }: CameraPanelProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastEmitRef = useRef(0)

  const [cameraReady, setCameraReady] = useState(false)
  const [settings, setSettings] = useState<PostureSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const settingsRef = useRef<PostureSettings | null>(null)
  const lastLandmarksRef = useRef<NormalizedLandmark[] | null>(null)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    window.api
      .getSettings()
      .then((s) => {
        setSettings(s)
      })
      .catch(console.error)
  }, [])

  const handleSaveSettings = async (newSettings: PostureSettings): Promise<void> => {
    await window.api.updateSettings(newSettings)
    setSettings(newSettings)
  }

  const handleDeleteSettings = async (): Promise<void> => {
    await window.api.deleteSettings()
    setSettings(null)
  }

  const handleQuickSetCurrentPosture = async (): Promise<void> => {
    const landmarks = lastLandmarksRef.current
    if (!landmarks) {
      return
    }

    const baseSettings = settings ?? DEFAULT_POSTURE_SETTINGS
    const nextSettings: PostureSettings = {
      shoulders: {
        ...baseSettings.shoulders,
        idealY: (landmarks[IDX.leftShoulder].y + landmarks[IDX.rightShoulder].y) / 2
      },
      ears: {
        ...baseSettings.ears,
        idealY: (landmarks[IDX.leftEar].y + landmarks[IDX.rightEar].y) / 2
      }
    }

    await handleSaveSettings(nextSettings)
  }

  useEffect(() => {
    if (!enabled) {
      onPostureUpdate('loading', 0, 'Camera is turned off')
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      detectorRef.current?.close()
      detectorRef.current = null

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      setCameraReady(false)
      return
    }

    let stopped = false

    const stopLoop = (): void => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const draw = (result: PoseLandmarkerResult): void => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) {
        return
      }

      const width = video.videoWidth
      const height = video.videoHeight
      if (!width || !height) {
        return
      }

      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        return
      }

      context.clearRect(0, 0, width, height)

      // Draw bounding tolerances
      const currentSettings = settingsRef.current
      if (currentSettings && currentSettings.shoulders && currentSettings.ears) {
        const drawBand = (conf: { idealY: number; tolerance: number }, color: string): void => {
          context.fillStyle = color
          const y1 = (conf.idealY - conf.tolerance) * height
          const y2 = (conf.idealY + conf.tolerance) * height
          const rectHeight = y2 - y1
          context.fillRect(0, y1, width, rectHeight)

          context.beginPath()
          context.strokeStyle = color.replace('0.15', '0.6')
          context.moveTo(0, conf.idealY * height)
          context.lineTo(width, conf.idealY * height)
          context.stroke()
        }

        // Draw for combined shoulders and ears
        drawBand(currentSettings.shoulders, 'rgba(56, 189, 248, 0.15)') // Light blue
        drawBand(currentSettings.ears, 'rgba(167, 139, 250, 0.15)') // Purple
      }

      if (result.landmarks.length > 0) {
        const drawingUtils = new DrawingUtils(context)
        drawingUtils.drawConnectors(result.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, {
          color: '#67e8f9',
          lineWidth: 3
        })
        drawingUtils.drawLandmarks(result.landmarks[0], {
          color: '#f8fafc',
          radius: 2.5
        })
      }
    }

    const run = async (): Promise<void> => {
      try {
        onPostureUpdate('loading', 0, 'Initializing webcam and pose model...')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        })

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        const video = videoRef.current
        if (!video) {
          throw new Error('Video element unavailable')
        }

        video.srcObject = stream
        await video.play()
        setCameraReady(true)

        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const detector = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1
        })

        detectorRef.current = detector

        const detect = (): void => {
          const activeVideo = videoRef.current
          const activeDetector = detectorRef.current
          if (!activeVideo || !activeDetector) {
            return
          }

          if (activeVideo.readyState >= 2) {
            const result = activeDetector.detectForVideo(activeVideo, performance.now())
            if (result.landmarks.length > 0) {
              lastLandmarksRef.current = result.landmarks[0]
            }

            draw(result)

            const now = Date.now()
            if (now - lastEmitRef.current > 250) {
              const posture = evaluatePosture(result, settingsRef.current)
              onPostureUpdate(posture.state, posture.confidence, posture.note)
              lastEmitRef.current = now
            }
          }

          rafRef.current = requestAnimationFrame(detect)
        }

        detect()
      } catch {
        onPostureUpdate('error', 0, 'Unable to start webcam or pose model.')
      }
    }

    void run()

    return () => {
      stopped = true
      stopLoop()
      detectorRef.current?.close()
      detectorRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [enabled, onPostureUpdate])

  return (
    <section className="card relative">
      <div className="camera-card-header">
        <h2>Camera Preview</h2>
        <div className="camera-card-actions">
          <button
            type="button"
            className="camera-quickset-btn"
            onClick={() => void handleQuickSetCurrentPosture()}
            disabled={!cameraReady || !lastLandmarksRef.current}
            title="Save the current posture as your target alignment"
          >
            Set Current as Perfect
          </button>
        </div>
      </div>
      <div className="camera-live-frame mt-4 relative">
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          Posture Detection Settings
        </button>
        <video className="camera-video" ref={videoRef} autoPlay playsInline muted />
        <canvas className="camera-overlay" ref={canvasRef} />
        {!cameraReady && (
          <div className="camera-placeholder">
            <div>
              <p>Starting camera...</p>
              <span>Allow webcam access to begin live posture feedback.</span>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <PostureSettingsModal
          initialSettings={settings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          onDelete={handleDeleteSettings}
          stream={streamRef.current}
          latestLandmarksRef={lastLandmarksRef}
        />
      )}
    </section>
  )
}

export default CameraPanel
