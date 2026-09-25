import { useSyncExternalStore } from 'react'
import { getProfile, subscribeActor, type Profile } from '../lib/actor'
import { sessionPhone, useAuth } from '../lib/auth'
import { SYNC_ENABLED } from '../lib/supabase'
import type { Person } from '../data/types'
import { personByPhone, useLaunchState } from '../store/launchStore'

export function useProfile(): Profile {
  return useSyncExternalStore(subscribeActor, getProfile, () => ({
    name: '',
    email: '',
    phone: '',
    role: '',
  }))
}

export function useActor(): string {
  return useProfile().name
}

/** Pessoa do cadastro que está logada (pelo telefone do token); undefined antes de carregar. */
export function useMe(): Person | undefined {
  const { session } = useAuth()
  const s = useLaunchState()
  return personByPhone(s, sessionPhone(session))
}

/** Admin vê e edita Usuários, avisos e backups. Sem servidor (modo local) tudo é liberado. */
export function useIsAdmin(): boolean {
  const me = useMe()
  return !SYNC_ENABLED || me?.admin === true
}

/** Financeiro aprova e reprova custo. É um papel dentro do admin. */
export function useIsFinance(): boolean {
  const me = useMe()
  return !SYNC_ENABLED || (me?.admin === true && me.finance === true)
}
