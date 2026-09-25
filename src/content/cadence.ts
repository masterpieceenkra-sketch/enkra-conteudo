import { addDays } from '../lib/dates'
import type { ContentFormat, ContentState, FunnelStage } from './model'

export interface CadenceRow {
  format: ContentFormat
  goal: number
  planned: number
}

/**
 * Meta de cadência da semana que começa em `monday`: por formato, quantos cards têm data de
 * publicação nesses 7 dias contra a meta da Estratégia.
 */
export function weekCadence(c: ContentState, monday: string): CadenceRow[] {
  const sunday = addDays(monday, 6)
  return c.strategy.cadence
    .filter((g) => g.perWeek > 0)
    .map((g) => ({
      format: g.format,
      goal: g.perWeek,
      planned: c.cards.filter(
        (k) => k.format === g.format && k.publishAt >= monday && k.publishAt <= sunday,
      ).length,
    }))
}

export interface PillarMix {
  pillarId: string
  name: string
  stage: FunnelStage
  count: number
  pct: number
}

/** Mix real por pilar entre duas datas (inclusive), pela data de publicação. */
export function pillarMix(c: ContentState, from: string, to: string): PillarMix[] {
  const inRange = c.cards.filter((k) => k.publishAt >= from && k.publishAt <= to)
  const total = inRange.filter((k) => k.pillarId).length
  return c.strategy.pillars
    .filter((p) => p.name.trim())
    .map((p) => {
      const count = inRange.filter((k) => k.pillarId === p.id).length
      return {
        pillarId: p.id,
        name: p.name,
        stage: p.stage,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }
    })
}
