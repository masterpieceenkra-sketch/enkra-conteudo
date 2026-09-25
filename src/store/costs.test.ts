import { describe, expect, it } from 'vitest'
import {
  amountInMonth,
  byCategory,
  counted,
  requests,
  formatBRL,
  monthlySeries,
  parseAmount,
  recurringPerMonth,
  type Cost,
} from './costs'

function cost(p: Partial<Cost> & Pick<Cost, 'amount_cents' | 'frequency' | 'spent_on'>): Cost {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    launch_id: 'comu',
    name: p.name ?? 'Custo',
    category: p.category ?? '',
    notes: '',
    paid_by: '',
    created_at: '2026-09-01T12:00:00Z',
    created_by: 'Wes',
    updated_at: null,
    // nas contas o que vale é o custo lançado, então o padrão aqui é aprovado
    status: 'aprovado',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    created_by_phone: null,
    ...p,
  }
}

describe('valores em reais', () => {
  it('lê o que a pessoa digita, no padrão brasileiro', () => {
    expect(parseAmount('1.500,00')).toBe(150000)
    expect(parseAmount('R$ 1.234,56')).toBe(123456)
    expect(parseAmount('89,90')).toBe(8990)
    expect(parseAmount('1200')).toBe(120000)
    expect(parseAmount('1200.50')).toBe(120050)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })

  it('mostra em reais', () => {
    expect(formatBRL(150000).replace(/ /g, ' ')).toBe('R$ 1.500,00')
    expect(formatBRL(0).replace(/ /g, ' ')).toBe('R$ 0,00')
  })
})

describe('quanto cada custo pesa no mês', () => {
  const unica = cost({ amount_cents: 50000, frequency: 'unica', spent_on: '2026-07-10' })
  const mensal = cost({ amount_cents: 30000, frequency: 'mensal', spent_on: '2026-07-01' })
  const trimestral = cost({ amount_cents: 90000, frequency: 'trimestral', spent_on: '2026-07-15' })
  const anual = cost({ amount_cents: 120000, frequency: 'anual', spent_on: '2025-09-20' })

  it('respeita a frequência e nunca conta antes da data', () => {
    expect(amountInMonth(unica, '2026-07')).toBe(50000)
    expect(amountInMonth(unica, '2026-08')).toBe(0)
    expect(amountInMonth(unica, '2026-06')).toBe(0)

    expect(amountInMonth(mensal, '2026-07')).toBe(30000)
    expect(amountInMonth(mensal, '2026-09')).toBe(30000)
    expect(amountInMonth(mensal, '2026-06')).toBe(0)

    expect(amountInMonth(trimestral, '2026-07')).toBe(90000)
    expect(amountInMonth(trimestral, '2026-08')).toBe(0)
    expect(amountInMonth(trimestral, '2026-10')).toBe(90000)

    expect(amountInMonth(anual, '2025-09')).toBe(120000)
    expect(amountInMonth(anual, '2026-09')).toBe(120000)
    expect(amountInMonth(anual, '2026-08')).toBe(0)
  })

  it('custo médio por mês ignora a única', () => {
    expect(recurringPerMonth([unica])).toBe(0)
    expect(recurringPerMonth([mensal])).toBe(30000)
    expect(recurringPerMonth([trimestral])).toBe(30000)
    expect(recurringPerMonth([anual])).toBe(10000)
    expect(recurringPerMonth([unica, mensal, anual])).toBe(40000)
  })
})

describe('mês a mês', () => {
  it('vai do primeiro mês com custo até o mês de hoje', () => {
    const costs = [
      cost({ amount_cents: 50000, frequency: 'unica', spent_on: '2026-07-10' }),
      cost({ amount_cents: 30000, frequency: 'mensal', spent_on: '2026-08-01' }),
    ]
    const s = monthlySeries(costs, '2026-09-23')
    expect(s.map((p) => p.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(s.map((p) => p.total)).toEqual([50000, 30000, 30000])
    expect(s[0].label).toMatch(/jul\/26/i)
  })

  it('limita a janela e devolve vazio sem custo', () => {
    const antigo = cost({ amount_cents: 1000, frequency: 'mensal', spent_on: '2020-01-05' })
    const s = monthlySeries([antigo], '2026-09-23')
    expect(s).toHaveLength(12)
    expect(s.at(-1)?.month).toBe('2026-09')
    expect(monthlySeries([], '2026-09-23')).toEqual([])
  })
})

describe('por categoria', () => {
  it('soma pelo peso mensal, agrupa sem categoria e fecha 100%', () => {
    const costs = [
      cost({
        amount_cents: 200000,
        frequency: 'mensal',
        spent_on: '2026-01-05',
        category: 'Tráfego',
      }),
      cost({
        amount_cents: 120000,
        frequency: 'anual',
        spent_on: '2026-09-05',
        category: 'Ferramentas',
      }),
      cost({ amount_cents: 100000, frequency: 'unica', spent_on: '2026-09-20', category: '' }),
      cost({ amount_cents: 999, frequency: 'unica', spent_on: '2026-05-20', category: 'Antiga' }),
    ]
    const cats = byCategory(costs, '2026-09-23')
    expect(cats.map((c) => c.key)).toEqual(['Tráfego', 'Sem categoria', 'Ferramentas'])
    expect(cats[0].total).toBe(200000)
    expect(cats[1].total).toBe(100000)
    expect(cats[2].total).toBe(10000)
    expect(cats.reduce((a, c) => a + c.pct, 0)).toBe(100)
    // custo único de um mês passado não entra na foto do mês atual
    expect(cats.some((c) => c.key === 'Antiga')).toBe(false)
  })
})

describe('solicitação x custo lançado', () => {
  it('só o aprovado entra nas contas; pendente e reprovado ficam nas solicitações', () => {
    const base = { amount_cents: 100000, frequency: 'mensal' as const, spent_on: '2026-09-01' }
    const pendente = cost({ ...base, category: 'Tráfego', status: 'pendente' })
    const aprovado = cost({ ...base, category: 'Equipe', status: 'aprovado' })
    const reprovado = cost({ ...base, category: 'Furada', status: 'reprovado' })
    const todos = [pendente, aprovado, reprovado]

    expect(recurringPerMonth(todos)).toBe(100000)
    expect(monthlySeries(todos, '2026-09-23').at(-1)?.total).toBe(100000)
    expect(byCategory(todos, '2026-09-23').map((c) => c.key)).toEqual(['Equipe'])
    expect(counted(todos)).toEqual([aprovado])
    expect(requests(todos).map((c) => c.status)).toEqual(['pendente', 'reprovado'])
  })
})
