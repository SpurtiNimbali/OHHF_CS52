export {
  supabase,
  isSupabaseConfigured,
  SUPABASE_SETUP_MESSAGE,
  formatSupabaseClientError,
} from './supabase'

/** Lazily created so `npm run dev` can start without Supabase vars until auth/data routes run. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!singleton) singleton = createBrowserSupabase()
    const value = Reflect.get(singleton, prop, receiver)
    return typeof value === 'function' ? (value as Function).bind(singleton) : value
  },
})
