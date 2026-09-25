/**
 * Números do Analytics do hub de conteúdo, puros e testados.
 *
 * - Planejado: card com data de publicação no período (qualquer coluna).
 * - Publicado: card em Publicado, contado pelo dia em que entrou lá (`publishedAt`); card antigo
 *   sem esse dia conta pela data de publicação.
 * - Atrasado: data de publicação já passou e o card não está em Publicado.
 * - Ajuste pedido: pedido de ajuste do cliente (comentário do tipo "ajuste") feito no período.
 * - Meta: soma da cadência semanal (Estratégia), proporcional aos dias do período.
 */
import { addDays, diffDays } from '../lib/dates'
import { mondayOf, monthTitle, shiftMonth } from './calendar'
import {
  FORMATS,
  columnOf,
  isPublished,
  type ContentCard,
  type ContentFormat,
  type ContentState,
} from './model'

export type PeriodKind = 'semana' | 'mes'

export interface Period {
  from: string
  to: string
  /** rótulo curto do eixo ("21/09", "set/26") */
  short: string
  /** rótulo do cabeçalho ("21 a 27 de set", "Setembro de 2026") */
  long: string
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return `${name}/${String(y).slice(2)}`
}

export function periodOf(kind: PeriodKind, anchor: string): Period {
  if (kind === 'semana') {
    const from = mondayOf(anchor)
    const to = addDays(from, 6)
    return { from, to, short: dm(from), long: `${dm(from)} a ${dm(to)}` }
  }
  const month = anchor.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: `${month}-01`, to, short: monthShort(month), long: monthTitle(month) }
}

/** `n` períodos terminando no do `anchor` (o mais antigo primeiro). */
export function periodsUntil(kind: PeriodKind, anchor: string, n: number): Period[] {
  const out: Period[] = []
  for (let i = n - 1; i >= 0; i--) {
    const a =
      kind === 'semana'
        ? addDays(mondayOf(anchor), -7 * i)
        : `${shiftMonth(anchor.slice(0, 7), -i)}-01`
    out.push(periodOf(kind, a))
  }
  return out
}

export function shiftPeriod(kind: PeriodKind, anchor: string, n: number): string {
  return kind === 'semana'
    ? addDays(mondayOf(anchor), 7 * n)
    : `${shiftMonth(anchor.slice(0, 7), n)}-01`
}

const inRange = (d: string, p: Period) => d !== '' && d >= p.from && d <= p.to

/** Dia em que o card foi publicado (vazio se não está em Publicado). */
export function publishedOn(c: ContentState, k: ContentCard): string {
  if (!isPublished(c, k)) return ''
  return k.publishedAt || k.publishAt
}

/** Dia (horário de Brasília) de um ISO datetime; vazio se inválido. */
export function localDay(isoDateTime: string): string {
  const t = Date.parse(isoDateTime)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export interface PeriodStats {
  period: Period
  planned: number
  published: number
  late: number
  adjusts: number
  goal: number
}

/** Meta do período: cadência semanal somada, proporcional aos dias (mês ≈ 4,3 semanas). */
export function goalFor(c: ContentState, p: Period, format?: ContentFormat): number {
  const weekly = c.strategy.cadence
    .filter((g) => !format || g.format === format)
    .reduce((a, g) => a + g.perWeek, 0)
  const days = diffDays(p.from, p.to) + 1
  return Math.round((weekly * days) / 7)
}

export function statsFor(c: ContentState, p: Period, today: string): PeriodStats {
  let planned = 0
  let published = 0
  let late = 0
  let adjusts = 0
  for (const k of c.cards) {
    if (inRange(k.publishAt, p)) {
      planned++
      if (k.publishAt < today && !isPublished(c, k)) late++
    }
    if (inRange(publishedOn(c, k), p)) published++
    for (const m of k.comments) if (m.kind === 'ajuste' && inRange(localDay(m.at), p)) adjusts++
  }
  return { period: p, planned, published, late, adjusts, goal: goalFor(c, p) }
}

export interface FormatGoal {
  format: ContentFormat
  goal: number
  published: number
  planned: number
}

/** Meta por formato no período: publicado de verdade e o que ainda está só planejado. */
export function goalByFormat(c: ContentState, p: Period): FormatGoal[] {
  return FORMATS.map((format) => {
    const cards = c.cards.filter((k) => k.format === format)
    return {
      format,
      goal: goalFor(c, p, format),
      published: cards.filter((k) => inRange(publishedOn(c, k), p)).length,
      planned: cards.filter((k) => inRange(k.publishAt, p)).length,
    }
  }).filter((r) => r.goal > 0 || r.published > 0)
}

export interface Waiting {
  card: ContentCard
  columnName: string
  /** dias com o cliente (0 quando não se sabe desde quando) */
  days: number
}

/** O que está com o cliente agora, do que espera há mais tempo para o mais recente. */
export function waitingOnClient(c: ContentState, today: string): Waiting[] {
  return c.cards
    .filter((k) => k.approval?.state === 'pendente' && columnOf(c, k)?.clientApproves)
    .map((k) => {
      const since = k.approval?.at ? localDay(k.approval.at) : ''
      return {
        card: k,
        columnName: columnOf(c, k)?.name ?? '',
        days: since ? Math.max(0, diffDays(since, today)) : 0,
      }
    })
    .sort((a, b) => b.days - a.days)
}

export interface PipelineRow {
  id: string
  name: string
  color: ContentState['columns'][number]['color']
  count: number
  late: number
}

/** Onde está o trabalho: cards por coluna, com quantos estão atrasados em cada uma. */
export function pipeline(c: ContentState, today: string): PipelineRow[] {
  return c.columns.map((col) => {
    const cards = c.cards.filter((k) => k.columnId === col.id)
    return {
      id: col.id,
      name: col.name,
      color: col.color,
      count: cards.length,
      late: cards.filter((k) => k.publishAt && k.publishAt < today && col.stage !== 'published')
        .length,
    }
  })
}

/** Porcentagem inteira limitada a 0–999 (acima da meta passa de 100). */
export function pct(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(999, Math.round((value / goal) * 100))
}
