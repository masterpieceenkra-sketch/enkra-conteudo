import { useEffect, useState } from 'react'
import { supabase, LAUNCH_ID, SYNC_ENABLED } from '../lib/supabase'
import type { ActivityRecord } from './activity'

interface Row {
  id: number
  at: string
  actor: string
  actor_email?: string | null
  action: ActivityRecord['action']
  entity_type: ActivityRecord['entityType'] | null
  entity_id: string | null
  entity_label: string | null
  details: Record<string, unknown> | null
}

function fromRow(r: Row): ActivityRecord {
  return {
    id: r.id,
    at: r.at,
    actor: r.actor,
    actorEmail: r.actor_email ?? undefined,
    action: r.action,
    entityType: r.entity_type ?? undefined,
    entityId: r.entity_id ?? undefined,
    entityLabel: r.entity_label ?? undefined,
    details: r.details ?? undefined,
  }
}

const PAGE = 100

/** Histórico do lançamento (mais recente primeiro), com paginação e atualização em tempo real. */
export function useActivity(opts: { entityId?: string; limit?: number } = {}) {
  const { entityId, limit = PAGE } = opts
  const key = `${entityId ?? ''}:${limit}`
  const [data, setData] = useState<{
    key: string
    items: ActivityRecord[]
    hasMore: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = SYNC_ENABLED && data?.key !== key
  const items = data?.key === key ? data.items : []

  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    const q = sb
      .from('comu_hub_activity')
      .select('*')
      .eq('launch_id', LAUNCH_ID)
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    const query = entityId ? q.eq('entity_id', entityId) : q
    void query.then(({ data: rows, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else {
        const list = (rows as Row[]).map(fromRow)
        setData({ key, items: list, hasMore: list.length === limit })
      }
    })
    const channel = sb
      .channel(`activity:${LAUNCH_ID}:${key}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comu_hub_activity',
          filter: `launch_id=eq.${LAUNCH_ID}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Row>).id
            setData((d) =>
              d && d.key === key ? { ...d, items: d.items.filter((x) => x.id !== id) } : d,
            )
            return
          }
          const r = fromRow(payload.new as Row)
          if (entityId && r.entityId !== entityId) return
          setData((d) => {
            if (!d || d.key !== key) return d
            // digitação contínua vira atualização do registro existente (a RPC coalesce em 10 min)
            const rest = d.items.filter((x) => x.id !== r.id)
            return { ...d, items: [r, ...rest] }
          })
        },
      )
      .subscribe()
    return () => {
      cancelled = true
      void sb.removeChannel(channel)
    }
  }, [entityId, limit, key])

  async function loadMore() {
    const sb = supabase()
    if (!sb || !data || data.key !== key || !data.items.length) return
    const last = data.items[data.items.length - 1]
    const q = sb
      .from('comu_hub_activity')
      .select('*')
      .eq('launch_id', LAUNCH_ID)
      .lt('id', last.id)
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    const { data: rows, error: err } = await (entityId ? q.eq('entity_id', entityId) : q)
    if (err) return setError(err.message)
    const list = (rows as Row[]).map(fromRow)
    setData((d) =>
      d && d.key === key
        ? { ...d, items: [...d.items, ...list], hasMore: list.length === limit }
        : d,
    )
  }

  return {
    items,
    loading,
    error,
    hasMore: data?.key === key ? data.hasMore : false,
    loadMore,
    enabled: SYNC_ENABLED,
  }
}
