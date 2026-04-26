import { useState, useEffect, useRef } from 'react'
import type { PostureSettings } from '../../../shared/backend'
import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

interface Props {
  initialSettings: PostureSettings | null
  onClose: () => void
  onSave: (settings: PostureSettings) => void
  onDelete: () => void | Promise<void>
  stream: MediaStream | null
  latestLandmarksRef: React.MutableRefObject<NormalizedLandmark[] | null>
}

const defaultSettings: PostureSettings = {
  shoulders: { idealY: 0.5, tolerance: 0.05 },
  ears: { idealY: 0.35, tolerance: 0.05 }
}

const IDX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftEar: 7,
  rightEar: 8
} as const

function withinMargin(a: number, b: number, epsilon = 0.002): boolean {
  return Math.abs(a - b) < epsilon
}

function getTrackedSettingsFromLandmarks(
  lm: NormalizedLandmark[],
  prev: PostureSettings
): PostureSettings | null {
  const leftShoulder = lm[IDX.leftShoulder]
  const rightShoulder = lm[IDX.rightShoulder]
  const leftEar = lm[IDX.leftEar]
  const rightEar = lm[IDX.rightEar]

  if (!leftShoulder || !rightShoulder || !leftEar || !rightEar) {
    return null
  }

  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2
  const avgEarY = (leftEar.y + rightEar.y) / 2

  return {
    shoulders: {
      ...prev.shoulders,
      idealY: avgShoulderY
    },
    ears: {
      ...prev.ears,
      idealY: avgEarY
    }
  }
}

export default function PostureSettingsModal({
  initialSettings,
  onClose,
  onSave,
  onDelete,
  stream,
  latestLandmarksRef
}: Props): React.JSX.Element {
  console.log('PostureSettingsModal render')
  const [settings, setSettings] = useState<PostureSettings>(initialSettings || defaultSettings)
  const [globalTolerance, setGlobalTolerance] = useState(0.05)
  const [followLandmarks, setFollowLandmarks] = useState(initialSettings ? false : true)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const drawRafRef = useRef<number | null>(null)
  const trackingRafRef = useRef<number | null>(null)

  const settingsRef = useRef<PostureSettings>(settings)
  const followLandmarksRef = useRef<boolean>(followLandmarks)

  const [statusMessage, setStatusMessage] = useState(
    initialSettings ? 'Locked for manual adjustment' : 'Following detected landmarks'
  )
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'warning' | 'error'>('neutral')

  const setFeedback = (
    message: string,
    tone: 'neutral' | 'success' | 'warning' | 'error' = 'neutral'
  ): void => {
    setStatusMessage(message)
    setStatusTone(tone)
  }

  useEffect(() => {
    if (initialSettings?.shoulders && initialSettings?.ears) {
      setSettings(initialSettings)
      setGlobalTolerance(initialSettings.shoulders.tolerance)
      setFollowLandmarks(false)
    } else {
      setSettings(defaultSettings)
      setGlobalTolerance(defaultSettings.shoulders.tolerance)
      setFollowLandmarks(true)
    }
  }, [initialSettings])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    followLandmarksRef.current = followLandmarks
  }, [followLandmarks])

  useEffect(() => {
    const nextSettings = initialSettings || defaultSettings
    setSettings(nextSettings)
    setGlobalTolerance(nextSettings.shoulders.tolerance)
  }, [initialSettings])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  
  useEffect(() => {
    const syncTrackedBounds = (): void => {
      const landmarks = latestLandmarksRef.current

      if (!landmarks) {
        console.log('[PostureSettingsModal] no landmarks yet')
      } else if (!followLandmarksRef.current) {
        console.log('[PostureSettingsModal] landmarks available, but follow is locked')
      } else {
        console.log('[PostureSettingsModal] following landmarks', {
          leftShoulder: landmarks[IDX.leftShoulder],
          rightShoulder: landmarks[IDX.rightShoulder],
          leftEar: landmarks[IDX.leftEar],
          rightEar: landmarks[IDX.rightEar]
        })
      }


      if (landmarks && followLandmarksRef.current) {
        setSettings((prev) => {
          const next = getTrackedSettingsFromLandmarks(landmarks, prev)
          if (!next) return prev

          const shouldersChanged = !withinMargin(prev.shoulders.idealY, next.shoulders.idealY)
          const earsChanged = !withinMargin(prev.ears.idealY, next.ears.idealY)

          if (!shouldersChanged && !earsChanged) {
            return prev
          }

          return next
        })
      }

      trackingRafRef.current = requestAnimationFrame(syncTrackedBounds)
    }

    trackingRafRef.current = requestAnimationFrame(syncTrackedBounds)

    return () => {
      if (trackingRafRef.current !== null) {
        cancelAnimationFrame(trackingRafRef.current)
      }
    }
  }, [latestLandmarksRef])

    useEffect(() => {
    const drawLoop = (): void => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas || video.readyState < 2) {
        drawRafRef.current = requestAnimationFrame(drawLoop)
        return
      }

      const width = video.videoWidth
      const height = video.videoHeight

      if (width && height) {
        if (canvas.width !== width) canvas.width = width
        if (canvas.height !== height) canvas.height = height

        const ctx = canvas.getContext('2d')

        if (ctx) {
          ctx.clearRect(0, 0, width, height)

          const currentSettings = settingsRef.current

          const drawBand = (conf: { idealY: number; tolerance: number }, color: string): void => {
            const y1 = Math.max(0, (conf.idealY - conf.tolerance) * height)
            const y2 = Math.min(height, (conf.idealY + conf.tolerance) * height)
            const rectHeight = Math.max(0, y2 - y1)

            ctx.fillStyle = color
            ctx.fillRect(0, y1, width, rectHeight)

            ctx.beginPath()
            ctx.strokeStyle = color.replace('0.15', '0.6')
            ctx.lineWidth = 2
            ctx.moveTo(0, conf.idealY * height)
            ctx.lineTo(width, conf.idealY * height)
            ctx.stroke()
          }

          drawBand(currentSettings.shoulders, 'rgba(56, 189, 248, 0.15)')
          drawBand(currentSettings.ears, 'rgba(167, 139, 250, 0.15)')

          const landmarks = latestLandmarksRef.current
          if (landmarks) {
            const drawingUtils = new DrawingUtils(ctx)
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
              color: '#67e8f9',
              lineWidth: 3
            })
            drawingUtils.drawLandmarks(landmarks, {
              color: '#f8fafc',
              radius: 2.5
            })
          }
        }
      }

      drawRafRef.current = requestAnimationFrame(drawLoop)
    }

    drawRafRef.current = requestAnimationFrame(drawLoop)

    return () => {
      if (drawRafRef.current !== null) {
        cancelAnimationFrame(drawRafRef.current)
      }
    }
  }, [latestLandmarksRef])

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

const handleToggleFollow = (): void => {
    if (followLandmarksRef.current) {
      setFollowLandmarks(false)
      setFeedback('Bounds locked for manual adjustment', 'neutral')
      return
    }

    const lm = latestLandmarksRef.current
    if (lm) {
      const next = getTrackedSettingsFromLandmarks(lm, settingsRef.current)
      if (next) {
        setSettings(next)
      }
    }

    setFollowLandmarks(true)
    setFeedback('Following detected landmarks, lock or set before exiting', 'warning')
  }

  const handleLocalQuickSet = (): void => {
    const lm = latestLandmarksRef.current
    if (!lm) return

    const next = getTrackedSettingsFromLandmarks(lm, settingsRef.current)
    if (!next) return

    setSettings(next)

    if (followLandmarksRef.current) {
      setFollowLandmarks(false)
    }
    setFeedback('Bounds set to current position', 'success')
  }

  const handleSave = async (): Promise<void> => {
    try {
      await onSave(settingsRef.current)
      setFeedback('Settings saved', 'success')
    } catch (err) {
      console.error(err)
      setFeedback('Failed to save settings', 'error')
    }
  }

  const handleDelete = async (): Promise<void> => {
    const confirmed = window.confirm(
      'Delete saved posture settings? This will remove your saved calibration.'
    )

    if (!confirmed) return

    try {
      await onDelete()
      setFollowLandmarks(true)
      setFeedback('Saved settings cleared', 'success')
    } catch (err) {
      console.error('Failed to delete saved posture settings', err)
      setFeedback('Failed to clear saved settings', 'warning')
    }
  }

  const handleClose = (): void => {
    if (followLandmarks){
      setFeedback('Failed to close, lock bounds before closing', 'error')
      return
    } else {
      onClose()
    }
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal p-6 rounded-lg text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Posture Detection Settings</h2>
          <button className="text-slate-400 hover:text-white transition" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="settings-split-layout">
          <div className="settings-left-col">
            <div className="mini-camera-container mb-4 shadow-inner rounded-md">
              <div className="mini-camera-wrapper">
                <video ref={videoRef} autoPlay playsInline muted className="mini-video" />
                <canvas ref={canvasRef} className="mini-canvas" />
              </div>
              <div className="y-axis-scale">
                <div className="y-tick" style={{ marginTop: '4px' }}>0.0</div>
                <div className="y-tick" style={{ marginTop: 'auto', marginBottom: 'auto' }}>0.5</div>
                <div className="y-tick" style={{ marginBottom: '4px' }}>1.0</div>
              </div>
            </div>

            <div className="p-4 bg-slate-700/50 rounded-md border border-slate-600/50">
              <h3 className="font-semibold mb-2 text-cyan-300">Intructions</h3>
              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                Keep your shoulders and head in frame.<br/>
                Lock the bounds or set the bounds' position when in desired location.
                Adjust manually for fine tune control.
                <br/>Remember to save your settings.
              </p>
            </div>
          </div>

          <div className="settings-right-col space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            <div className="border border-slate-600 bg-slate-800/50 p-4 rounded-md mb-2">
              <div className="flex flex-col gap-3 items-center justify-center">
                <button
                  onClick={handleToggleFollow}
                  className={`w-[90%] text-white font-semibold py-1.5 px-4 rounded transition shadow-lg ${
                    followLandmarks
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-cyan-600 hover:bg-cyan-500'
                  }`}
                >
                  {followLandmarks ? 'Lock Bounds' : 'Unlock Bounds'}
                </button>

                <button
                  onClick={handleLocalQuickSet}
                  className="w-[90%] bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1.5
                             px-4 rounded transition shadow-lg hover:shadow-cyan-500/20"
                >
                  Set Bounds To Current Position
                </button>
              </div>

              <p
                className={`text-s mt-3
                  ${statusTone === 'success' ? 'text-emerald-300'
                  : statusTone === 'warning' ? 'text-amber-300'
                  : statusTone === 'error' ? 'text-red-300'
                  : 'text-slate-400'}`}
              >
                {statusMessage}
              </p>
            </div>
            <div className="bg-slate-700/80 p-3 rounded-md border border-slate-600">
              <h3 className="font-semibold mb-2 text-slate-100">Global Tolerance Offset</h3>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={globalTolerance}
                  onChange={handleGlobalToleranceChange}
                  className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-mono w-10 text-right text-slate-300">
                  {globalTolerance.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Adjusts the acceptable deviation range for all bounds.
              </p>
            </div>

            {(['ears', 'shoulders'] as const).map((point) => (
              settings[point] && (
                <div key={point} className="bg-slate-700/80 p-3 rounded-md border border-slate-600">
                  <h4 className="capitalize font-medium mb-3 text-slate-200">
                    {point}
                  </h4>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-xs text-slate-400 font-medium w-20">Ideal Y:</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings[point].idealY}
                        onChange={(e) => handlePointChange(point, 'idealY', parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-mono w-10 text-right text-slate-300">
                        {settings[point].idealY.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <label className="text-xs text-slate-400 font-medium w-20">Tolerance:</label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.2"
                        step="0.01"
                        value={settings[point].tolerance}
                        onChange={(e) => handlePointChange(point, 'tolerance', parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-mono w-10 text-right text-slate-300">
                        {settings[point].tolerance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-700/50">
          <button
            onClick={handleSave}
            className="settings-action-btn settings-action-btn-primary"
          >
            Save Settings
          </button>
          <button
            onClick={handleDelete}
            className="px-5 py-2 border border-slate-500 rounded text-sm hover:bg-slate-700 transition"
          >
            Clear Saved Settings
          </button>
          <button
            onClick={handleClose}
            className="px-5 py-2 border border-slate-500 rounded text-sm hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
