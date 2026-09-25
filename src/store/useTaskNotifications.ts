import { createContext, useEffect, useState } from 'react'
import { LAUNCH_ID, supabase } from '../lib/supabase'

/** Por tarefa: pessoas (id) que já receberam um aviso dela (tarefa atribuída ou atualizada). */
export type TaskNotified = Map<string, Set<string>>

export const TaskNotifiedCtx = createContext<TaskNotified>(new Map())

interface Row {
  task_id: string | null
  person_id: string | null
  kind: string
  status: string
}

/** Avisos enviados por tarefa, ao vivo. Só conta `sent`; fila e falha ficam de fora. */
export function useTaskNotifications(): TaskNotified {
  const [map, setMap] = useState<TaskNotified>(new Map())
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    const load = async () => {
      const { data } = await sb
        .from('comu_hub_notifications')
        .select('task_id,person_id,kind,status')
        .eq('launch_id', LAUNCH_ID)
        .eq('status', 'sent')
        .in('kind', ['task_assigned', 'task_update'])
        .not('task_id', 'is', null)
        .limit(5000)
      if (cancelled) return
      const next: TaskNotified = new Map()
      for (const r of (data ?? []) as Row[]) {
        if (!r.task_id || !r.person_id) continue
        const set = next.get(r.task_id) ?? new Set<string>()
        set.add(r.person_id)
        next.set(r.task_id, set)
      }
      setMap(next)
    }
    void load()
    const channel = sb
      .channel(`task-notifications:${LAUNCH_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comu_hub_notifications',
          filter: `launch_id=eq.${LAUNCH_ID}`,
        },
        () => void load(),
      )
      .subscribe()
    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [])
  return map
}
