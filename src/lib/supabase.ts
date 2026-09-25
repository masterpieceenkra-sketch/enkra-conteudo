import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BOARD_ID } from './board'

/** Configuração vem do build (VITE_*). Sem ela o app roda só no navegador. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
/** Quadro desta página (ver lib/board.ts). Re-exportado aqui porque o app inteiro lê daqui. */
export const LAUNCH_ID = BOARD_ID

export const SYNC_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY)

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (!SYNC_ENABLED) return null
  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}
