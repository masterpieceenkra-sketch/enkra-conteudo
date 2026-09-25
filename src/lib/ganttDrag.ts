import { addDays } from './dates'

export interface Drag {
  id: string
  mode: 'move' | 'start' | 'end'
  originX: number
  start: string
  end: string
  delta: number
}

/** Datas resultantes de um arrasto: mover desloca as duas; puxar a borda nunca cruza a outra. */
export function dragResult(d: Drag): { start: string; end: string } {
  if (d.mode === 'move') return { start: addDays(d.start, d.delta), end: addDays(d.end, d.delta) }
  if (d.mode === 'start') {
    const s = addDays(d.start, d.delta)
    return { start: s > d.end ? d.end : s, end: d.end }
  }
  const e = addDays(d.end, d.delta)
  return { start: d.start, end: e < d.start ? d.start : e }
}

/** Gantt: uma linha por fase, régua de meses e semanas, marcos e reuniões, linha de hoje. */
