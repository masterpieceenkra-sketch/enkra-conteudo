import { addDays, diffDays } from '../lib/dates'
import type { Drag } from '../lib/ganttDrag'
import { mondayOf } from './calendar'
import type { ContentState } from './model'

/**
 * Janela do cronograma: de duas semanas antes de hoje (ou do começo da primeira campanha)
 * até dez semanas depois (ou o fim da última campanha / último post), em semanas inteiras.
 * Limitada a 18 meses para a régua não virar um rolo infinito.
 */
export function timelineRange(c: ContentState, today: string): { from: string; to: string } {
  let from = addDays(today, -14)
  let to = addDays(today, 70)
  for (const cp of c.campaigns) {
    if (cp.start && cp.start < from) from = cp.start
    if (cp.end && cp.end > to) to = cp.end
  }
  for (const k of c.cards) if (k.publishAt && k.publishAt > to) to = k.publishAt
  const start = mondayOf(from)
  let end = addDays(mondayOf(to), 6)
  if (diffDays(start, end) > 548) end = addDays(start, 548)
  return { from: start, to: end }
}

/** Arrasto no cronograma: barra de campanha ou marco de card (reaproveita a conta do Gantt). */
export type TimelineDrag = Drag & { kind: 'campaign' | 'card' }
