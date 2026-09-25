import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import {
  APP_FLAVOR,
  APP_NAME,
  BASE_PATH,
  BOARD_ID,
  BOARD_MODE,
  BOARD_STORAGE_PREFIXES,
} from './lib/board'
import { getAuth, sessionPhone } from './lib/auth'
import { getProfile, setProfile } from './lib/actor'
import { SYNC_ENABLED, supabase } from './lib/supabase'
import { getSync, personByPhone, startSync, subscribe, load } from './store/launchStore'
import { supabaseTransport } from './store/supabaseTransport'
import './index.css'

// o index.html é do Comu HUB; o app de conteúdo se apresenta com o próprio nome desde a entrada
if (APP_FLAVOR === 'content') document.title = APP_NAME

const actor = () => {
  const p = getProfile()
  return { name: p.name, email: p.email }
}

/** Ao sair, nenhum dado de quadro fica neste navegador — nem de outros quadros. */
function clearBoardStorage() {
  try {
    for (const key of Object.keys(localStorage))
      if (BOARD_STORAGE_PREFIXES.some((p) => key === p || key.startsWith(`${p}:`)))
        localStorage.removeItem(key)
  } catch {
    // sem armazenamento local
  }
}

if (!SYNC_ENABLED) {
  startSync(null, BOARD_ID, actor)
} else if (BOARD_ID) {
  // O motor de sincronização só liga com sessão aberta: sem login o banco não responde.
  let running = false
  const sb = supabase()!
  sb.auth.onAuthStateChange((_event, session) => {
    if (session && !running) {
      running = true
      startSync(supabaseTransport(), BOARD_ID, actor)
      // "sem acesso" é problema DESTE quadro (a pessoa pode ser de outro), então a sessão fica de
      // pé e a tela explica o que houve. Quem não está em quadro nenhum é desconectado.
    } else if (!session && running) {
      running = false
      getSync()?.stop()
      clearBoardStorage()
      if (BOARD_MODE === 'hub') window.location.assign('/')
      else window.location.reload()
    }
  })
  getAuth()
  // Perfil (nome no histórico, e-mail, cargo) vem do cadastro da pessoa logada.
  const syncProfile = () => {
    const phone = sessionPhone(getAuth().session)
    if (!phone) return
    const me = personByPhone(load(), phone)
    if (!me) return
    const cur = getProfile()
    const next = { name: me.name, email: me.email, phone: me.phone, role: me.role ?? '' }
    if (
      cur.name !== next.name ||
      cur.email !== next.email ||
      cur.phone !== next.phone ||
      cur.role !== next.role
    )
      setProfile(next)
  }
  subscribe(syncProfile)
  sb.auth.onAuthStateChange(syncProfile)
} else {
  // Raiz do hub: sem quadro para sincronizar, só a sessão.
  getAuth()
  supabase()!.auth.onAuthStateChange((_event, session) => {
    if (!session) clearBoardStorage()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={BASE_PATH || undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
