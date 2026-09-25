import { describe, expect, it } from 'vitest'
import { pillarMix, weekCadence } from './cadence'
import { byDay, monthGrid, mondayOf, shiftMonth, weekDays } from './calendar'
import { feedCards } from './feed'
import { blankCard, defaultContent, type ContentState } from './model'
import { timelineRange } from './timeline'

const card = (id: string, col: string, extra = {}) => ({
  ...blankCard(id, col, 'Wes'),
  title: id,
  ...extra,
})

describe('calendário', () => {
  it('grade do mês vai de segunda a domingo, em semanas inteiras', () => {
    const g = monthGrid('2026-09')
    expect(g[0]).toBe('2026-08-31') // 1º de setembro de 2026 é terça
    expect(g.at(-1)).toBe('2026-10-04')
    expect(g.length % 7).toBe(0)
    expect(monthGrid('2026-02').length).toBe(35)
  })

  it('semana começa na segunda, e o mês vira o ano', () => {
    expect(mondayOf('2026-09-27')).toBe('2026-09-21') // domingo
    expect(weekDays('2026-09-23')).toHaveLength(7)
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('agrupa por dia e ordena pelo horário, sem horário por último', () => {
    const m = byDay([
      card('a', 'c-ideias', { publishAt: '2026-09-30' }),
      card('b', 'c-ideias', { publishAt: '2026-09-30', publishTime: '18:00' }),
      card('c', 'c-ideias', { publishAt: '2026-09-30', publishTime: '09:00' }),
      card('d', 'c-ideias'),
    ])
    expect(m.get('2026-09-30')!.map((k) => k.id)).toEqual(['c', 'b', 'a'])
    expect(m.size).toBe(1)
  })
})

describe('cronograma', () => {
  it('cobre hoje com folga e estica até a campanha mais longa', () => {
    const c = defaultContent()
    expect(timelineRange(c, '2026-09-25')).toEqual({ from: '2026-09-07', to: '2026-12-06' })
    c.campaigns = [
      {
        id: 'x',
        name: 'Longa',
        color: 'pink',
        start: '2026-08-01',
        end: '2027-02-10',
        objective: '',
        notes: '',
      },
    ]
    const r = timelineRange(c, '2026-09-25')
    expect(r.from).toBe('2026-07-27')
    expect(r.to).toBe('2027-02-14')
  })
})

describe('grade do feed', () => {
  function c(): ContentState {
    const s = defaultContent()
    s.cards = [
      card('ideia', 'c-ideias', { publishAt: '2026-10-05' }),
      card('prog', 'c-programado', { publishAt: '2026-10-01', publishTime: '12:00' }),
      card('prog2', 'c-programado', { publishAt: '2026-10-01', publishTime: '18:00' }),
      card('pub', 'c-publicado', { publishAt: '2026-09-20' }),
      card('story', 'c-programado', { publishAt: '2026-10-02', format: 'stories' }),
      card('tt', 'c-programado', { publishAt: '2026-10-03', networks: ['tiktok'] }),
    ]
    return s
  }

  it('mais novo primeiro, sem stories nem outra rede', () => {
    expect(feedCards(c(), 'instagram', 'tudo').map((k) => k.id)).toEqual([
      'ideia',
      'prog2',
      'prog',
      'pub',
    ])
  })

  it('"só programado e no ar" tira o que ainda está em produção', () => {
    expect(feedCards(c(), 'instagram', 'agenda').map((k) => k.id)).toEqual(['prog2', 'prog', 'pub'])
  })
})

describe('cadência e mix por pilar', () => {
  it('conta por formato na semana contra a meta', () => {
    const s = defaultContent()
    s.strategy.cadence = [
      { format: 'reels', perWeek: 14 },
      { format: 'estatico', perWeek: 7 },
      { format: 'carrossel', perWeek: 0 },
    ]
    s.cards = [
      card('a', 'c-ideias', { format: 'reels', publishAt: '2026-09-21' }),
      card('b', 'c-ideias', { format: 'reels', publishAt: '2026-09-27' }),
      card('c', 'c-ideias', { format: 'reels', publishAt: '2026-09-28' }),
      card('d', 'c-ideias', { format: 'estatico', publishAt: '2026-09-22' }),
    ]
    expect(weekCadence(s, '2026-09-21')).toEqual([
      { format: 'reels', goal: 14, planned: 2 },
      { format: 'estatico', goal: 7, planned: 1 },
    ])
  })

  it('mix por pilar só conta card com pilar e fecha em porcentagem', () => {
    const s = defaultContent()
    s.cards = [
      card('a', 'c-ideias', { pillarId: 'pl-topo', publishAt: '2026-09-10' }),
      card('b', 'c-ideias', { pillarId: 'pl-topo', publishAt: '2026-09-11' }),
      card('c', 'c-ideias', { pillarId: 'pl-fundo', publishAt: '2026-09-12' }),
      card('d', 'c-ideias', { publishAt: '2026-09-12' }),
      card('e', 'c-ideias', { pillarId: 'pl-meio', publishAt: '2026-08-01' }),
    ]
    const mix = pillarMix(s, '2026-09-01', '2026-09-30')
    expect(mix.map((p) => [p.name, p.count, p.pct])).toEqual([
      ['Alcance', 2, 67],
      ['Autoridade', 0, 0],
      ['Conversão', 1, 33],
    ])
  })
})
