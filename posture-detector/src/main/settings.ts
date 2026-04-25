import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import type { PostureSettings } from '../shared/backend'

function getSettingsFilePath(): string {
  const userDataPath = app.getPath('userData')
  console.log("Settings save location: ", userDataPath)
  return join(userDataPath, 'posture_settings.json')
}

export function getSettings(): PostureSettings | null {
  const filePath = getSettingsFilePath()

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const data = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data) as unknown as PostureSettings

    if (!parsed?.shoulders || !parsed?.ears) {
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
      unlinkSync(filePath)
    }
    return true
  } catch (err) {
    console.error('Failed to delete settings', err)
    return false
  }
}