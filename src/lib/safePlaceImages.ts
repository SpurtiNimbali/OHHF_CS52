import { ensureAuthUserId, isSupabaseConfigured, supabase } from './supabase'

const BUCKET = 'safe-place-images'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const GENERIC_IMAGE_KEY = 'cardea-safe-place-generic-image'

export function loadGenericSafePlaceImage(): string | null {
  try {
    const raw = localStorage.getItem(GENERIC_IMAGE_KEY)
    return raw?.trim() || null
  } catch {
    return null
  }
}

export function saveGenericSafePlaceImage(url: string | null) {
  try {
    if (!url) localStorage.removeItem(GENERIC_IMAGE_KEY)
    else localStorage.setItem(GENERIC_IMAGE_KEY, url)
  } catch {
    /* ignore */
  }
}

function extensionForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName
  }
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export function validateSafePlaceImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Use a JPG, PNG, WebP, or GIF image.'
  }
  if (file.size > MAX_BYTES) {
    return 'Image must be 5 MB or smaller.'
  }
  return null
}

export async function uploadSafePlaceImage(
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateSafePlaceImageFile(file)
  if (validationError) return { url: null, error: validationError }

  if (!isSupabaseConfigured) {
    return { url: null, error: 'Supabase is not configured in .env.' }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { url: null, error: 'Sign in required to upload an image.' }
  }

  const ext = extensionForFile(file)
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('bucket') || message.includes('not found')) {
      return {
        url: null,
        error:
          'Image storage is not set up yet. Run supabase/migrations/20260528120000_safe_place_images.sql in Supabase.',
      }
    }
    return { url: null, error: error.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
