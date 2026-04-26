import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import type { PostureSettings } from '../shared/backend'

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
  console.log("Settings save location: ", userDataPath)
  return join(userDataPath, 'posture_settings.json')
}

export function getSettings(): PostureSettings | null {
  const filePath = getSettingsFilePath()

  if (!existsSync(filePath)) {
    // Do not write default for correct start behavior
    console.log("No sync for file path")
    return null
  }

  try {
    const data = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data) as unknown
    if (!isPostureSettings(parsed)) {
      console.log("Not parsed posture settings")
      return null
    }
    return parsed
  } catch (err) {
    console.error('Failed to read settings, returning null', err)
    return null
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

export function deleteSettings(): boolean {
  const filePath = getSettingsFilePath()

  try {
    if (existsSync(filePath)) {
      rmSync(filePath)
    }
    return true
  } catch (err) {
    console.error('Failed to delete settings', err)
    return false
  }
}
