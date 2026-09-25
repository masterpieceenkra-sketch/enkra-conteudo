import { addDays } from '../lib/dates'
import type { LabelColor } from '../data/types'
import type { ContentCard, ContentFormat, ContentState } from './model'

/** Segunda-feira da semana do dia informado. */
export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00`).getDay()
  return addDays(iso, -((dow + 6) % 7))
}

/** Os 7 dias (segunda a domingo) da semana do dia informado. */
export function weekDays(iso: string): string[] {
  const start = mondayOf(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Grade do mês 'yyyy-mm': semanas inteiras, de segunda a domingo (5 ou 6 linhas). */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const start = mondayOf(first)
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const end = addDays(mondayOf(last), 6)
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const raw = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Cards por dia de publicação, na ordem do horário (sem horário por último). */
export function byDay(cards: ContentCard[]): Map<string, ContentCard[]> {
  const map = new Map<string, ContentCard[]>()
  for (const k of cards) {
    if (!k.publishAt) continue
    const list = map.get(k.publishAt) ?? []
    list.push(k)
    map.set(k.publishAt, list)
  }
  for (const list of map.values())
    list.sort((a, b) => (a.publishTime || '99:99').localeCompare(b.publishTime || '99:99'))
  return map
}

export type ColorBy = 'campanha' | 'formato' | 'status'

export const FORMAT_COLOR: Record<ContentFormat, LabelColor> = {
  reels: 'pink',
  carrossel: 'blue',
  estatico: 'lime',
  stories: 'aqua',
  video: 'black',
  outro: 'gray',
}

/** Cor do card no calendário e no cronograma, conforme a legenda escolhida. */
export function cardColor(c: ContentState, card: ContentCard, by: ColorBy): LabelColor {
  if (by === 'formato') return FORMAT_COLOR[card.format]
  if (by === 'status') return c.columns.find((x) => x.id === card.columnId)?.color ?? 'gray'
  return c.campaigns.find((x) => x.id === card.campaignId)?.color ?? 'gray'
}
