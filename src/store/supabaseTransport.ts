import type { LaunchState, Task } from '../data/types'
import { accessToken } from '../lib/auth'
import { LAUNCH_ID, SUPABASE_KEY, SUPABASE_URL, supabase } from '../lib/supabase'
import type { Profile } from '../lib/actor'
import type { ActivityInput } from './activity'
import type { CommitConflict, CommitOk, SyncTransport } from './sync'

const TABLE = 'comu_hub_launches'
const RPC = 'comu_hub_commit'

/** Enfileira uma mensagem personalizada no WhatsApp para pessoas do cadastro. Lança erro se falhar. */
export async function sendCustomMessage(
  personIds: string[],
  message: string,
  actor: Profile,
  launchId = LAUNCH_ID,
): Promise<{ sent: number; names: string[] }> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { data, error } = await sb.rpc('comu_hub_send_custom', {
    p_launch_id: launchId,
    p_person_ids: personIds,
    p_message: message,
    p_actor: actor.name,
    p_actor_email: actor.email,
  })
  if (error) throw new Error(error.message)
  const r = data as { sent: number; names: string[] }
  return { sent: r.sent ?? 0, names: r.names ?? [] }
}

/** Reenvia ao responsável o aviso da tarefa com o estado atual do card. Lança erro se falhar. */
export async function sendTaskUpdate(
  task: Task,
  actor: Profile,
  launchId = LAUNCH_ID,
): Promise<{ names: string[] }> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { data, error } = await sb.rpc('comu_hub_send_task_update', {
    p_launch_id: launchId,
    p_task: {
      id: task.id,
      label: task.label,
      due: task.due,
      ownerId: task.ownerId ?? '',
      ownerIds: task.ownerIds ?? (task.ownerId ? [task.ownerId] : []),
      checklists: task.checklists ?? [],
    },
    p_actor: actor.name,
    p_actor_email: actor.email,
  })
  if (error) throw new Error(error.message)
  const r = data as { names?: string[]; name?: string }
  return { names: r.names ?? (r.name ? [r.name] : []) }
}

/** Transporte real: PostgREST + RPC + Realtime do Supabase. */
export function supabaseTransport(): SyncTransport | null {
  const sb = supabase()
  if (!sb) return null
  return {
    async fetch(launchId) {
      const { data, error } = await sb
        .from(TABLE)
        .select('state,version')
        .eq('id', launchId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? { state: data.state, version: Number(data.version) } : null
    },
    async commit(
      launchId,
      state: LaunchState,
      expectedVersion,
      actor,
      events: ActivityInput[],
      opts,
    ) {
      const body = {
        p_id: launchId,
        p_state: state,
        p_expected_version: expectedVersion,
        p_actor: actor.name,
        p_events: events,
        p_actor_email: actor.email,
      }
      if (opts?.keepalive) {
        // Ao fechar a aba o SDK pode não completar; fetch com keepalive completa.
        // O token é o da sessão: a RPC só aceita quem está no cadastro (a chave anônima é recusada).
        const token = accessToken()
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${RPC}`, {
          method: 'POST',
          keepalive: true,
          headers: {
            apikey: SUPABASE_KEY!,
            Authorization: `Bearer ${token || SUPABASE_KEY!}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`commit ${res.status}`)
        return (await res.json()) as CommitOk | CommitConflict
      }
      const { data, error } = await sb.rpc(RPC, body)
      if (error) throw new Error(error.message)
      return data as CommitOk | CommitConflict
    },
    subscribe(launchId, onChange) {
      const channel = sb
        .channel(`launch:${launchId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: TABLE, filter: `id=eq.${launchId}` },
          onChange,
        )
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
