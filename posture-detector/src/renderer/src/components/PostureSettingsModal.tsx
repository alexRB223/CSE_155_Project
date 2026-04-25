import { useState, useEffect, useRef } from 'react'
import type { PostureSettings } from '../../../shared/backend'
import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

interface Props {
  initialSettings: PostureSettings | null
  onClose: () => void
  onSave: (settings: PostureSettings) => void
  stream: MediaStream | null
  latestLandmarksRef: React.MutableRefObject<NormalizedLandmark[] | null>
}

const defaultSettings: PostureSettings = {
  shoulders: { idealY: 0.5, tolerance: 0.05 },
  ears: { idealY: 0.35, tolerance: 0.05 }
}

const defaultGlobalTolerance = 0.05

const IDX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftEar: 7,
  rightEar: 8
} as const

export default function PostureSettingsModal({
  initialSettings,
  onClose,
  onSave,
  stream,
  latestLandmarksRef
}: Props): React.JSX.Element {
  const [settings, setSettings] = useState<PostureSettings>(initialSettings || defaultSettings)
  const [globalTolerance, setGlobalTolerance] = useState(defaultGlobalTolerance)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const settingsRef = useRef<PostureSettings>(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }

    const drawLoop = (): void => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(drawLoop)
        return
      }

      const width = video.videoWidth
      const height = video.videoHeight
      if (width && height) {
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)

          const currentSettings = settingsRef.current
          if (currentSettings && currentSettings.shoulders && currentSettings.ears) {
            const drawBand = (conf: { idealY: number; tolerance: number }, color: string): void => {
              ctx.fillStyle = color
              const y1 = (conf.idealY - conf.tolerance) * height
              const y2 = (conf.idealY + conf.tolerance) * height
              const rectHeight = y2 - y1
              ctx.fillRect(0, y1, width, rectHeight)

              ctx.beginPath()
              ctx.strokeStyle = color.replace('0.15', '0.6')
              ctx.moveTo(0, conf.idealY * height)
              ctx.lineTo(width, conf.idealY * height)
              ctx.stroke()
            }

            drawBand(currentSettings.shoulders, 'rgba(56, 189, 248, 0.15)') // Shoulders band
            drawBand(currentSettings.ears, 'rgba(167, 139, 250, 0.15)') // Ears band
          }

          const landmarks = latestLandmarksRef.current
          if (landmarks) {
            const drawingUtils = new DrawingUtils(ctx)
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
              color: '#67e8f9',
              lineWidth: 3
            })
            drawingUtils.drawLandmarks(landmarks, { color: '#f8fafc', radius: 2.5 })
          }
        }
      }
      rafRef.current = requestAnimationFrame(drawLoop)
    }

    drawLoop()

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [stream, latestLandmarksRef])

  const handlePointChange = (
    point: keyof PostureSettings,
    field: 'idealY' | 'tolerance',
    value: number
  ): void => {
    setSettings((prev) => ({
      ...prev,
      [point]: {
        ...prev[point],
        [field]: value
      }
    }))
  }

  const handleGlobalToleranceChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = parseFloat(e.target.value)
    setGlobalTolerance(val)
    setSettings((prev) => ({
      shoulders: { ...prev.shoulders, tolerance: val },
      ears: { ...prev.ears, tolerance: val }
    }))
  }

  const handleSave = (): void => {
    onSave(settings)
  }

  const handleLocalQuickSet = (): void => {
    const lm = latestLandmarksRef.current
    if (!lm) return

    const avgShoulderY = (lm[IDX.leftShoulder].y + lm[IDX.rightShoulder].y) / 2
    const avgEarY = (lm[IDX.leftEar].y + lm[IDX.rightEar].y) / 2

    setSettings((prev) => ({
      ...prev,
      shoulders: { ...prev.shoulders, idealY: avgShoulderY },
      ears: { ...prev.ears, idealY: avgEarY }
    }))
  }

  const handleResetToDefaults = (): void => {
    setSettings({
      shoulders: { ...defaultSettings.shoulders },
      ears: { ...defaultSettings.ears }
    })
    setGlobalTolerance(defaultGlobalTolerance)
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal p-6 rounded-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Posture Settings</h2>
          <button type="button" className="settings-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-split-layout">
          {/* LEFT COL: Camera & Quick Set */}
          <div className="settings-left-col">
            <div className="mini-camera-container mb-4 shadow-inner rounded-md">
              <div className="mini-camera-wrapper">
                <video ref={videoRef} autoPlay playsInline muted className="mini-video" />
                <canvas ref={canvasRef} className="mini-canvas" />
              </div>
              <div className="y-axis-scale">
                <div className="y-tick" style={{ marginTop: '4px' }}>
                  0.0
                </div>
                <div className="y-tick" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
                  0.5
                </div>
                <div className="y-tick" style={{ marginBottom: '4px' }}>
                  1.0
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-700/50 rounded-md border border-slate-600/50">
              <h3 className="font-semibold mb-2 text-cyan-300">Quick Set</h3>
              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                Sit in your ideal posture, then click the button below to map the bounds locally.
                Adjust sliders to refine, then save.
              </p>
              <button
                onClick={handleLocalQuickSet}
                className="settings-action-btn settings-action-btn-primary w-full"
              >
                Set Current as Perfect
              </button>
            </div>
          </div>

          {/* RIGHT COL: Controls */}
          <div className="settings-right-col space-y-4 max-h-[65vh] overflow-y-auto pr-3 custom-scrollbar">
            <div className="border border-slate-600 bg-slate-800/50 p-4 rounded-md mb-2">
              <h3 className="font-semibold mb-2 text-slate-100">Global Tolerance Offset</h3>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={globalTolerance}
                  onChange={handleGlobalToleranceChange}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm font-mono w-12 text-right bg-slate-900 px-2 rounded border border-slate-600">
                  {globalTolerance.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Adjusts the acceptable deviation range for all points.
              </p>
            </div>

            {(['shoulders', 'ears'] as const).map(
              (point) =>
                settings[point] && (
                  <div
                    key={point}
                    className="bg-slate-700/80 p-3 rounded-md border border-slate-600"
                  >
                    <h4 className="capitalize font-medium mb-3 text-slate-200">{point}</h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-xs text-slate-400 font-medium w-20">Ideal Y:</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={settings[point].idealY}
                          onChange={(e) =>
                            handlePointChange(point, 'idealY', parseFloat(e.target.value))
                          }
                          className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs font-mono w-10 text-right text-cyan-300">
                          {settings[point].idealY.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-xs text-slate-400 font-medium w-20">
                          Tolerance:
                        </label>
                        <input
                          type="range"
                          min="0.01"
                          max="0.2"
                          step="0.01"
                          value={settings[point].tolerance}
                          onChange={(e) =>
                            handlePointChange(point, 'tolerance', parseFloat(e.target.value))
                          }
                          className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs font-mono w-10 text-right text-slate-300">
                          {settings[point].tolerance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-[96px] pt-4 border-t border-slate-700/50">
          <button
            onClick={handleResetToDefaults}
            className="settings-action-btn settings-action-btn-secondary"
          >
            Reset to Defaults
          </button>
          <button onClick={handleSave} className="settings-action-btn settings-action-btn-primary">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
