import { addDays, type IsoDate } from '../lib/dates'
import type { Milestone } from './types'

export const DEFAULT_LAUNCH_START: IsoDate = '2026-09-18'

/** Offsets (em dias a partir do início) de cada fase padrão. */
export const PHASE_OFFSETS: { id: string; start: number; end: number }[] = [
  // Backlog: as duas semanas antes do início oficial
  { id: 'f0', start: -14, end: -1 },
  { id: 'f1', start: 0, end: 6 },
  { id: 'f2', start: 7, end: 13 },
  { id: 'f3', start: 14, end: 27 },
  { id: 'f4', start: 28, end: 34 },
  { id: 'f5', start: 35, end: 41 },
  { id: 'f6', start: 42, end: 45 },
  { id: 'f7', start: 46, end: 49 },
]

const MILESTONE_OFFSETS: { id: string; label: string; day: number }[] = [
  { id: 'm1', label: 'Início da captação', day: 14 },
  { id: 'm2', label: 'CPL 1', day: 28 },
  { id: 'm3', label: 'CPL 2', day: 29 },
  { id: 'm4', label: 'CPL 3', day: 30 },
  { id: 'm5', label: 'Abertura do carrinho principal', day: 35 },
  { id: 'm6', label: 'Fechamento do carrinho principal', day: 41 },
  { id: 'm7', label: 'Abertura do carrinho downsell', day: 42 },
  { id: 'm8', label: 'Fechamento do carrinho downsell', day: 45 },
]

export function defaultPhaseDates(
  launchStart: IsoDate,
): Record<string, { start: IsoDate; end: IsoDate }> {
  const out: Record<string, { start: IsoDate; end: IsoDate }> = {}
  for (const p of PHASE_OFFSETS) {
    out[p.id] = { start: addDays(launchStart, p.start), end: addDays(launchStart, p.end) }
  }
  return out
}

export function defaultMilestones(launchStart: IsoDate): Milestone[] {
  return MILESTONE_OFFSETS.map((m) => ({
    id: m.id,
    label: m.label,
    date: addDays(launchStart, m.day),
  }))
}
