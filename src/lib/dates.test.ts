import { describe, expect, it } from 'vitest'
import { addDays, diffDays, formatBr, isValidIso, relativeLabel, todayIso } from './dates'

describe('dates', () => {
  it('formata ISO em pt-BR', () => {
    expect(formatBr('2026-09-18')).toBe('18/09/2026')
    expect(formatBr('')).toBe('--/--/----')
    expect(formatBr(undefined)).toBe('--/--/----')
  })

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('calcula diferença em dias', () => {
    expect(diffDays('2026-09-18', '2026-10-02')).toBe(14)
    expect(diffDays('2026-10-02', '2026-09-18')).toBe(-14)
  })

  it('valida ISO', () => {
    expect(isValidIso('2026-09-18')).toBe(true)
    expect(isValidIso('18/09/2026')).toBe(false)
    expect(isValidIso('')).toBe(false)
  })

  it('gera rótulos relativos', () => {
    expect(relativeLabel('2026-09-18', '2026-09-18')).toBe('hoje')
    expect(relativeLabel('2026-09-19', '2026-09-18')).toBe('amanhã')
    expect(relativeLabel('2026-09-25', '2026-09-18')).toBe('faltam 7 dias')
    expect(relativeLabel('2026-09-15', '2026-09-18')).toBe('há 3 dias')
  })

  it('todayIso usa data local', () => {
    expect(todayIso(new Date(2026, 8, 18, 23, 59))).toBe('2026-09-18')
  })
})
