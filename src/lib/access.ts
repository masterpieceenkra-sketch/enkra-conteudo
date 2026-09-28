import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Último acesso de cada pessoa. O app avisa o servidor que a pessoa está usando o painel
 * (`comu_hub_touch`, no máximo a cada 5 minutos) e a tela Usuários lê, só para admin,
 * o último acesso e o último código pedido de cada número (`comu_hub_people_access`).
 */

const TOUCH_EVERY_MS = 5 * 60_000
let lastTouch = 0

/** Marca "usando agora"; chamado ao abrir a sessão e ao voltar para a aba. */
export function touchPresence(now = Date.now()): void {
  const sb = supabase()
  if (!sb || now - lastTouch < TOUCH_EVERY_MS) return
  lastTouch = now
  void sb.rpc('comu_hub_touch').then(({ error }) => {
    if (error) lastTouch = 0
  })
}

export interface Access {
  seen: string | null
  code: string | null
}

/** Último acesso e último código por número do quadro (vazio para quem não é admin). */
export function usePeopleAccess(boardId: string): Map<string, Access> {
  const [map, setMap] = useState<Map<string, Access>>(() => new Map())
  useEffect(() => {
    const sb = supabase()
    if (!sb || !boardId) return
    let cancelled = false
    void sb.rpc('comu_hub_people_access', { p_launch: boardId }).then(({ data }) => {
      if (cancelled || !Array.isArray(data)) return
      const next = new Map<string, Access>()
      for (const r of data as {
        phone: string
        last_seen_at: string | null
        last_code_at: string | null
      }[])
        next.set(r.phone, { seen: r.last_seen_at, code: r.last_code_at })
      setMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [boardId])
  return map
}

/** Junta os números da pessoa: o acesso e o código mais recentes entre eles. */
export function accessFor(map: Map<string, Access>, phones: string[]): Access {
  const latest = (vals: (string | null | undefined)[]) =>
    vals
      .filter((v): v is string => !!v)
      .sort()
      .at(-1) ?? null
  const rows = phones.map((p) => map.get(p))
  return { seen: latest(rows.map((r) => r?.seen)), code: latest(rows.map((r) => r?.code)) }
}

/** "hoje às 12:20", "ontem às 09:05", "28/09 às 12:20" ou "28/09/2025 às 12:20". */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff === 0) return `hoje às ${time}`
  if (diff === 1) return `ontem às ${time}`
  const date = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
  return `${date} às ${time}`
}

/** Texto da linha de acesso na tela Usuários. */
export function accessLabel(a: Access, now: Date = new Date()): string {
  if (a.seen) return `Último acesso ${formatWhen(a.seen, now)}`
  if (a.code) return `Ainda não entrou · código enviado ${formatWhen(a.code, now)}`
  return 'Ainda não entrou'
}
