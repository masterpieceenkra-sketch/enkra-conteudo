import { useEffect, useState } from 'react'
import { APP_FLAVOR, BOARD_ID, isValidSlug } from '../lib/board'
import { supabase } from '../lib/supabase'
import type { BoardKind, LaunchState } from '../data/types'

/** Um quadro na lista "Meus quadros" (só o que o cartão mostra; o estado fica no servidor). */
export interface BoardCard {
  id: string
  name: string
  kind: BoardKind
  role: 'admin' | 'member' | 'client'
  updated_at: string
  people: number
  tasks_open: number
}

/** Quadros em que o telefone da sessão está cadastrado. */
export function useMyBoards(): { boards: BoardCard[]; loading: boolean; error: string | null } {
  const [boards, setBoards] = useState<BoardCard[]>([])
  const [loading, setLoading] = useState(() => supabase() !== null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    void (async () => {
      const { data, error } = await sb.rpc('comu_hub_my_launches')
      if (cancelled) return
      if (error) setError(error.message)
      // cada app só lista os quadros que sabe abrir
      else
        setBoards(
          ((data ?? []) as BoardCard[]).filter(
            (b) => (b.kind === 'content') === (APP_FLAVOR === 'content'),
          ),
        )
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return { boards, loading, error }
}

/** Se o telefone da sessão administra a plataforma (pode criar quadro). */
export function usePlatformOwner(): boolean {
  const [owner, setOwner] = useState(false)
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    void sb.rpc('comu_hub_is_platform_owner').then(({ data }) => {
      if (!cancelled) setOwner(data === true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return owner
}

/** Se o telefone da sessão está em algum quadro (usado para decidir encerrar a sessão). */
export async function isMemberAnywhere(): Promise<boolean> {
  const sb = supabase()
  if (!sb) return true
  const { data } = await sb.rpc('comu_hub_is_member_any')
  return data === true
}

export async function slugAvailable(id: string): Promise<boolean> {
  const sb = supabase()
  if (!sb || !isValidSlug(id)) return false
  const { data } = await sb.rpc('comu_hub_slug_available', { p_id: id })
  return data === true
}

/** Cria o quadro com o estado do modelo escolhido. Devolve o id para abrir em seguida. */
export async function createBoard(id: string, state: LaunchState): Promise<string> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { data, error } = await sb.rpc('comu_hub_create_launch', { p_id: id, p_state: state })
  if (error) throw new Error(error.message)
  const ok = (data as { ok?: boolean; id?: string } | null)?.id
  return ok ?? id
}

/** Quadro aberto agora (vazio na raiz do hub). */
export const currentBoardId = BOARD_ID
