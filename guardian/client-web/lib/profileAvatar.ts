'use client'

const PROFILE_AVATAR_PREFIX = 'guardian_profile_avatar_'

function keyFor(userID: string): string {
  return `${PROFILE_AVATAR_PREFIX}${userID}`
}

export function getProfileAvatar(userID: string): string | null {
  if (typeof window === 'undefined' || !userID) return null
  try {
    return window.localStorage.getItem(keyFor(userID))
  } catch {
    return null
  }
}

export function setProfileAvatar(userID: string, dataUrl: string): void {
  if (typeof window === 'undefined' || !userID || !dataUrl) return
  try {
    window.localStorage.setItem(keyFor(userID), dataUrl)
  } catch {
    // Ignore local storage quota errors.
  }
}

export function clearProfileAvatar(userID: string): void {
  if (typeof window === 'undefined' || !userID) return
  try {
    window.localStorage.removeItem(keyFor(userID))
  } catch {
    // Ignore local storage errors.
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}
