import { useEffect, useState } from 'react'
import { LAUNCH_ID, SYNC_ENABLED, supabase } from '../lib/supabase'
import type { NotificationRow } from './analytics'

/** Últimos avisos do lançamento (até 1000), atualizados quando a fila muda. */
export function useNotifications(): {
  rows: NotificationRow[]
  loading: boolean
  error: string | null
} {
  const [rows, setRows] = useState<NotificationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    const load = async () => {
      const { data, error: err } = await sb
        .from('comu_hub_notifications')
        .select('id,kind,person_id,person_name,status,created_at')
        .eq('launch_id', LAUNCH_ID)
        .order('id', { ascending: false })
        .limit(1000)
      if (cancelled) return
      if (err) setError(err.message)
      else setRows((data ?? []) as NotificationRow[])
    }
    void load()
    const channel = sb
      .channel(`notifications:${LAUNCH_ID}`)
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

  return { rows: rows ?? [], loading: SYNC_ENABLED && rows === null, error }
}
