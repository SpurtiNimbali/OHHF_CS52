import { supabase, isSupabaseConfigured } from './supabase'

export type ApiResult<T> = { data: T; error: null } | { data: null; error: string }

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session?.access_token ?? null
}

export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...init, headers })
}
