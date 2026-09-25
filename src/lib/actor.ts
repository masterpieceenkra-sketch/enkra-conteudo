import { storageKey } from './board'

/** Quem está usando o app neste navegador: nome, e-mail e WhatsApp. Sem login; vai para o histórico. */
export interface Profile {
  name: string
  email: string
  phone: string
  /** cargo ou função no lançamento */
  role: string
}

const KEY = storageKey('gps-actor')
const EMPTY: Profile = { name: '', email: '', phone: '', role: '' }
const listeners = new Set<() => void>()
let cached: Profile | null = null

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

export function isValidPhone(v: string): boolean {
  const d = v.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 15
}

export function getProfile(): Profile {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(KEY) ?? ''
    if (raw.startsWith('{')) {
      const p = JSON.parse(raw) as Partial<Profile>
      cached = {
        name: (p.name ?? '').trim(),
        email: (p.email ?? '').trim(),
        phone: (p.phone ?? '').trim(),
        role: (p.role ?? '').trim(),
      }
    } else {
      // versão anterior guardava só o nome
      cached = { ...EMPTY, name: raw.trim() }
    }
  } catch {
    cached = { ...EMPTY }
  }
  return cached
}

/** Perfil completo = nome, e-mail válido e WhatsApp válido. */
export function isProfileComplete(p: Profile = getProfile()): boolean {
  return p.name.trim() !== '' && isValidEmail(p.email) && isValidPhone(p.phone)
}

/** Nome para o histórico (compatível com o que o motor de sincronização espera). */
export function getActor(): string {
  return getProfile().name
}

export function setProfile(p: Profile) {
  cached = {
    name: p.name.trim().slice(0, 80),
    email: p.email.trim().toLowerCase().slice(0, 160),
    phone: p.phone.trim().slice(0, 30),
    role: p.role.trim().slice(0, 60),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    // sem storage: vale só para esta sessão
  }
  listeners.forEach((l) => l())
}

export function clearProfile() {
  setProfile({ ...EMPTY })
}

export function subscribeActor(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
