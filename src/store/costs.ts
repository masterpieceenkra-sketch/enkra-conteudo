import { useCallback, useEffect, useState } from 'react'
import { LAUNCH_ID, supabase } from '../lib/supabase'

/**
 * Custos do quadro. Ficam numa tabela própria (`comu_hub_costs`), fora do documento do
 * lançamento: o estado é lido por qualquer membro, e custo só admin vê. A RLS da tabela
 * exige admin, e gravar passa pelas RPCs `comu_hub_cost_save` / `comu_hub_cost_remove`.
 */

export const FREQUENCIES = ['unica', 'mensal', 'trimestral', 'anual'] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  unica: 'Única',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

/** Quantas vezes por ano o custo se repete (para o custo médio por mês). */
const TIMES_PER_YEAR: Record<Frequency, number> = {
  unica: 0,
  mensal: 12,
  trimestral: 4,
  anual: 1,
}

export const COST_STATUSES = ['pendente', 'aprovado', 'reprovado'] as const
export type CostStatus = (typeof COST_STATUSES)[number]

export const STATUS_LABEL: Record<CostStatus, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
}

export interface Cost {
  id: string
  launch_id: string
  name: string
  amount_cents: number
  frequency: Frequency
  category: string
  notes: string
  paid_by: string
  /** yyyy-mm-dd: data do gasto; em custo que se repete, quando começou */
  spent_on: string
  created_at: string
  created_by: string
  updated_at: string | null
  /** pendente até o financeiro decidir */
  status: CostStatus
  decided_by: string | null
  decided_at: string | null
  /** justificativa da reprovação */
  decision_note: string | null
  created_by_phone: string | null
}

export interface CostDraft {
  id?: string
  name: string
  amount_cents: number
  frequency: Frequency
  category: string
  notes: string
  paid_by: string
  spent_on: string
}

// ---------- dinheiro ----------

/** "1.234,56" ou "1234.56" → 123456 centavos. */
export function parseAmount(v: string): number {
  const clean = v.replace(/[^\d,.-]/g, '')
  if (!clean) return 0
  // com vírgula, ela é o separador decimal e o ponto é milhar (padrão brasileiro)
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  })
}

/** Valor curto para eixo e rótulo de gráfico: R$ 1,2 mil / R$ 15 mil. */
export function formatShortBRL(cents: number): string {
  const v = cents / 100
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return formatBRL(cents)
}

// ---------- períodos ----------

/** 'yyyy-mm' do dia informado. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const nome = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `${nome.replace('.', '')}/${String(y).slice(2)}`
}

/** Meses entre dois 'yyyy-mm' (negativo se b < a). */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

/**
 * Quanto este custo pesa no mês informado.
 * Única conta no mês do gasto; mensal conta todo mês a partir dele; trimestral a cada 3 meses;
 * anual no mesmo mês de cada ano. Nada conta antes da data do gasto.
 */
export function amountInMonth(c: Cost, month: string): number {
  const start = monthOf(c.spent_on)
  const d = monthDiff(start, month)
  if (d < 0) return 0
  if (c.frequency === 'unica') return d === 0 ? c.amount_cents : 0
  if (c.frequency === 'mensal') return c.amount_cents
  if (c.frequency === 'trimestral') return d % 3 === 0 ? c.amount_cents : 0
  return d % 12 === 0 ? c.amount_cents : 0
}

/**
 * Só custo aprovado é custo lançado: é o que entra em total, donut e mês a mês.
 * Solicitação pendente ou reprovada fica fora das contas.
 */
export function counted(costs: Cost[]): Cost[] {
  return costs.filter((c) => c.status === 'aprovado')
}

/** Solicitações: o que ainda não virou custo lançado. */
export function requests(costs: Cost[]): Cost[] {
  return costs.filter((c) => c.status !== 'aprovado')
}

/** Custo médio por mês do que se repete (a única fica de fora). */
export function recurringPerMonth(all: Cost[]): number {
  const costs = counted(all)
  return costs.reduce(
    (sum, c) => sum + Math.round((c.amount_cents * TIMES_PER_YEAR[c.frequency]) / 12),
    0,
  )
}

export interface MonthPoint {
  month: string
  label: string
  total: number
}

/** Série do gráfico: do primeiro mês com custo (no máximo `maxMonths` atrás) até o mês atual. */
export function monthlySeries(all: Cost[], today: string, maxMonths = 12): MonthPoint[] {
  const costs = counted(all)
  const current = monthOf(today)
  if (costs.length === 0) return []
  const first = costs.reduce(
    (min, c) => (monthOf(c.spent_on) < min ? monthOf(c.spent_on) : min),
    current,
  )
  const start =
    monthDiff(first, current) > maxMonths - 1 ? addMonths(current, -(maxMonths - 1)) : first
  const out: MonthPoint[] = []
  for (let m = start; monthDiff(m, current) >= 0; m = addMonths(m, 1))
    out.push({
      month: m,
      label: monthLabel(m),
      total: costs.reduce((sum, c) => sum + amountInMonth(c, m), 0),
    })
  return out
}

export interface CategorySlice {
  key: string
  label: string
  total: number
  count: number
  pct: number
}

/** Proporção por categoria, considerando o custo médio por mês de cada lançamento. */
export function byCategory(all: Cost[], today: string): CategorySlice[] {
  const costs = counted(all)
  const month = monthOf(today)
  const map = new Map<string, { total: number; count: number }>()
  for (const c of costs) {
    // o que se repete entra pelo custo médio mensal; a única entra no mês dela
    const value =
      c.frequency === 'unica'
        ? amountInMonth(c, month)
        : Math.round((c.amount_cents * TIMES_PER_YEAR[c.frequency]) / 12)
    if (value === 0) continue
    const key = c.category.trim() || 'Sem categoria'
    const cur = map.get(key) ?? { total: 0, count: 0 }
    map.set(key, { total: cur.total + value, count: cur.count + 1 })
  }
  const slices = [...map.entries()].map(([key, v]) => ({ key, label: key, ...v }))
  const total = slices.reduce((a, s) => a + s.total, 0)
  return slices
    .map((s) => ({ ...s, pct: total === 0 ? 0 : Math.round((s.total / total) * 100) }))
    .sort((a, b) => b.total - a.total)
}

// ---------- servidor ----------

export function useCosts(): {
  costs: Cost[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [costs, setCosts] = useState<Cost[]>([])
  const [loading, setLoading] = useState(() => supabase() !== null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    void (async () => {
      const { data, error } = await sb
        .from('comu_hub_costs')
        .select('*')
        .eq('launch_id', LAUNCH_ID)
        .order('spent_on', { ascending: false })
        .limit(1000)
      if (cancelled) return
      if (error) setError(error.message)
      else {
        setCosts((data ?? []) as Cost[])
        setError(null)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [tick])

  return { costs, loading, error, reload }
}

export async function saveCost(d: CostDraft): Promise<string> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { data, error } = await sb.rpc('comu_hub_cost_save', {
    p_launch_id: LAUNCH_ID,
    p_id: d.id ?? null,
    p_name: d.name,
    p_amount_cents: d.amount_cents,
    p_frequency: d.frequency,
    p_category: d.category,
    p_notes: d.notes,
    p_paid_by: d.paid_by,
    p_spent_on: d.spent_on,
  })
  if (error) throw new Error(error.message)
  return String(data)
}

/** Decisão do financeiro. Reprovar sem justificativa é recusado pelo servidor. */
export async function decideCost(id: string, status: CostStatus, note: string): Promise<void> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { error } = await sb.rpc('comu_hub_cost_decide', {
    p_launch_id: LAUNCH_ID,
    p_id: id,
    p_status: status,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}

export async function removeCost(id: string): Promise<void> {
  const sb = supabase()
  if (!sb) throw new Error('Servidor não configurado')
  const { error } = await sb.rpc('comu_hub_cost_remove', { p_launch_id: LAUNCH_ID, p_id: id })
  if (error) throw new Error(error.message)
}
