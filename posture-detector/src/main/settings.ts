import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { PostureSettings } from '../shared/backend'

const defaultSettings: PostureSettings = {
  shoulders: { idealY: 0.5, tolerance: 0.05 },
  ears: { idealY: 0.35, tolerance: 0.05 }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPostureSettings(value: unknown): value is PostureSettings {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  const shoulders = record.shoulders
  const ears = record.ears

  if (!shoulders || typeof shoulders !== 'object') return false
  if (!ears || typeof ears !== 'object') return false

  const shouldersRecord = shoulders as Record<string, unknown>
  const earsRecord = ears as Record<string, unknown>

  return (
    isFiniteNumber(shouldersRecord.idealY) &&
    isFiniteNumber(shouldersRecord.tolerance) &&
    isFiniteNumber(earsRecord.idealY) &&
    isFiniteNumber(earsRecord.tolerance)
  )
}

function getSettingsFilePath(): string {
  // Use user data directory to persist across updates
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'posture_settings.json')
}

export function getSettings(): PostureSettings {
  const filePath = getSettingsFilePath()

  if (!existsSync(filePath)) {
    // Write defaults if it doesn't exist
    updateSettings(defaultSettings)
    return defaultSettings
  }

  try {
    const data = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data) as unknown
    if (!isPostureSettings(parsed)) {
      updateSettings(defaultSettings)
      return defaultSettings
    }
    return parsed
  } catch (err) {
    console.error('Failed to read settings, returning default', err)
    return defaultSettings
  }
}

export function updateSettings(settings: PostureSettings): boolean {
  const filePath = getSettingsFilePath()
  try {
    writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to write settings', err)
    return false
  }
}
