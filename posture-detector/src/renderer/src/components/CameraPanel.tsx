import { useEffect, useRef, useState } from 'react'
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult
} from '@mediapipe/tasks-vision'

export type PostureState = 'loading' | 'good' | 'slouching' | 'no-person' | 'error'

interface CameraPanelProps {
  onPostureUpdate: (state: PostureState, confidence: number, note: string) => void
  enabled: boolean
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

function evaluatePosture(result: PoseLandmarkerResult): {
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
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2
  const earMidY = (leftEar.y + rightEar.y) / 2
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y)

  const headTooLow = earMidY > shoulderMidY - 0.02
  const shouldersUneven = shoulderTilt > 0.05

  if (headTooLow || shouldersUneven) {
    return {
      state: 'slouching',
      confidence,
      note: 'Raise your chest and keep shoulders level.'
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
            draw(result)

            const now = Date.now()
            if (now - lastEmitRef.current > 250) {
              const posture = evaluatePosture(result)
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
    <section className="card">
      <h2>Camera Preview</h2>
      <div className="camera-live-frame">
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
    </section>
  )
}

export default CameraPanel
