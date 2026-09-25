import { describe, expect, it } from 'vitest'
import {
  goalByFormat,
  goalFor,
  localDay,
  pct,
  periodOf,
  periodsUntil,
  pipeline,
  shiftPeriod,
  statsFor,
  waitingOnClient,
} from './analytics'
import { blankCard, defaultContent, moveCard, withPublishedFor, type ContentState } from './model'

const TODAY = '2026-09-25' // sexta
const card = (id: string, col: string, extra = {}) => ({ ...blankCard(id, col, 'Wes'), ...extra })

function board(): ContentState {
  const c = defaultContent()
  c.strategy.cadence = [
    { format: 'reels', perWeek: 7 },
    { format: 'estatico', perWeek: 3 },
  ]
  c.cards = [
    // publicado nesta semana (entrou em Publicado na quarta)
    card('a', 'c-publicado', { publishAt: '2026-09-23', publishedAt: '2026-09-23' }),
    // publicado antigo, sem o dia registrado: conta pela data de publicação
    card('b', 'c-publicado', { publishAt: '2026-09-22', format: 'estatico' }),
    // planejado para sábado, ainda programado
    card('c', 'c-programado', { publishAt: '2026-09-26' }),
    // atrasado: era para quarta e não saiu
    card('d', 'c-producao', { publishAt: '2026-09-23' }),
    // semana passada, com ajuste pedido ontem
    card('e', 'c-revisao', {
      publishAt: '2026-09-18',
      approval: { state: 'pendente', at: '2026-09-21T12:00:00Z' },
      comments: [
        {
          id: 'm',
          authorId: '',
          authorName: 'Cliente',
          text: 'Trocar a trilha',
          at: '2026-09-24T15:00:00Z',
          kind: 'ajuste',
        },
      ],
    }),
  ]
  return c
}

describe('períodos', () => {
  it('semana vai de segunda a domingo; mês do primeiro ao último dia', () => {
    expect(periodOf('semana', TODAY)).toMatchObject({ from: '2026-09-21', to: '2026-09-27' })
    expect(periodOf('mes', TODAY)).toMatchObject({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodOf('mes', '2026-02-10').to).toBe('2026-02-28')
  })

  it('histórico termina no período escolhido e anda para trás', () => {
    const ps = periodsUntil('semana', TODAY, 3)
    expect(ps.map((p) => p.from)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21'])
    expect(shiftPeriod('mes', TODAY, -1)).toBe('2026-08-01')
  })
})

describe('números do período', () => {
  it('publicado conta o que foi para Publicado; atrasado é data passada sem sair', () => {
    const s = statsFor(board(), periodOf('semana', TODAY), TODAY)
    expect(s).toMatchObject({ planned: 4, published: 2, late: 1, adjusts: 1, goal: 10 })
  })

  it('meta do mês é a semanal proporcional aos dias', () => {
    expect(goalFor(board(), periodOf('mes', TODAY))).toBe(43) // 10 × 30/7
    expect(goalFor(board(), periodOf('semana', TODAY), 'reels')).toBe(7)
  })

  it('meta por formato traz publicado e planejado', () => {
    const rows = goalByFormat(board(), periodOf('semana', TODAY))
    expect(rows.find((r) => r.format === 'reels')).toEqual({
      format: 'reels',
      goal: 7,
      published: 1,
      planned: 3,
    })
    expect(pct(1, 7)).toBe(14)
    expect(pct(3, 0)).toBe(0)
  })

  it('com o cliente mostra há quantos dias espera', () => {
    const w = waitingOnClient(board(), TODAY)
    expect(w.map((x) => [x.card.id, x.days])).toEqual([['e', 4]])
  })

  it('onde está o trabalho conta por coluna e os atrasados', () => {
    const rows = pipeline(board(), TODAY)
    expect(rows.find((r) => r.id === 'c-producao')).toMatchObject({ count: 1, late: 1 })
    expect(rows.find((r) => r.id === 'c-publicado')).toMatchObject({ count: 2, late: 0 })
  })

  it('dia do comentário é o de Brasília', () => {
    expect(localDay('2026-09-25T02:00:00Z')).toBe('2026-09-24')
  })
})

describe('data de publicação real', () => {
  it('entrar em Publicado marca o dia; sair apaga', () => {
    let c = defaultContent()
    c.cards = [card('k', 'c-programado', { publishAt: '2026-09-20' })]
    c = withPublishedFor(moveCard(c, 'k', 'c-publicado', 0), 'k', TODAY)
    expect(c.cards[0].publishedAt).toBe(TODAY)
    c = withPublishedFor(moveCard(c, 'k', 'c-programado', 0), 'k', TODAY)
    expect(c.cards[0].publishedAt).toBe('')
  })
})
