import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { PostureSettings } from '../shared/backend'

const defaultSettings: PostureSettings = {
  shoulders: { idealY: 0.5, tolerance: 0.05 },
  ears: { idealY: 0.35, tolerance: 0.05 }
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
    const parsed = JSON.parse(data) as any
    // Migration check: if old structure, wipe to new default
    if (!parsed.shoulders || !parsed.ears) {
      updateSettings(defaultSettings)
      return defaultSettings
    }
    return parsed as PostureSettings
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
