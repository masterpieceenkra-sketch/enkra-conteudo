import type { Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { BOARD_ID } from './board'
import { SUPABASE_KEY, SUPABASE_URL, SYNC_ENABLED, supabase } from './supabase'

/**
 * Sessão do usuário (Supabase Auth). O login é por código no WhatsApp: a edge function
 * `comu-hub-login` valida o código e devolve um token_hash que abre a sessão aqui.
 * O telefone fica em `app_metadata.phone` (gravado pelo servidor) e é o que dá as permissões.
 */

type AuthState = { status: 'loading' | 'signed_out' | 'signed_in'; session: Session | null }

let state: AuthState = { status: SYNC_ENABLED ? 'loading' : 'signed_in', session: null }
const listeners = new Set<() => void>()
let started = false

function set(next: AuthState) {
  state = next
  listeners.forEach((l) => l())
}

function start() {
  if (started) return
  started = true
  const sb = supabase()
  if (!sb) return
  void sb.auth.getSession().then(({ data }) => {
    set({ status: data.session ? 'signed_in' : 'signed_out', session: data.session })
  })
  sb.auth.onAuthStateChange((_event, session) => {
    set({ status: session ? 'signed_in' : 'signed_out', session })
  })
}

export function getAuth(): AuthState {
  start()
  return state
}

export function useAuth(): AuthState {
  start()
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
}

/** Telefone (só dígitos) de quem está logado, vindo do token; vazio sem sessão. */
export function sessionPhone(s: Session | null = state.session): string {
  const meta = s?.user.app_metadata as { phone?: unknown } | undefined
  return typeof meta?.phone === 'string' ? meta.phone : ''
}

export function accessToken(): string {
  return state.session?.access_token ?? ''
}

async function callLogin(body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/comu-hub-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY ?? '' },
    // Sem quadro na URL (raiz do hub) o servidor procura o telefone em qualquer quadro.
    body: JSON.stringify({ ...(BOARD_ID ? { launchId: BOARD_ID } : {}), ...body }),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok)
    throw new Error(typeof data.error === 'string' ? data.error : `Falha (${res.status})`)
  return data
}

/** Pede o código no WhatsApp. Resposta é a mesma para número fora do cadastro. */
export async function requestCode(phone: string): Promise<string> {
  const r = await callLogin({ action: 'request', phone })
  return typeof r.message === 'string' ? r.message : ''
}

/** Confere o código e abre a sessão neste navegador. */
export async function verifyCode(phone: string, code: string): Promise<void> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const r = await callLogin({ action: 'verify', phone, code })
  const tokenHash = typeof r.token_hash === 'string' ? r.token_hash : ''
  if (!tokenHash) throw new Error('Resposta inválida do servidor')
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (error) throw new Error('Não foi possível abrir a sessão. Peça um novo código.')
}

export async function signOut(): Promise<void> {
  const sb = supabase()
  if (!sb) return
  await sb.auth.signOut()
}
