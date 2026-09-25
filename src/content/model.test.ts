import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTER,
  blankCard,
  cardsIn,
  defaultContent,
  duplicateCard,
  isDueLate,
  isLate,
  matchesFilter,
  moveCard,
  parseContent,
  removeCampaign,
  removeColumn,
  type ContentState,
} from './model'

function board(): ContentState {
  const c = defaultContent()
  const mk = (id: string, col: string, extra = {}) => ({
    ...blankCard(id, col, 'Wes'),
    title: id,
    ...extra,
  })
  c.cards = [
    mk('a', 'c-ideias'),
    mk('b', 'c-ideias'),
    mk('c', 'c-aprovado'),
    mk('d', 'c-ideias'),
    mk('e', 'c-publicado', { publishAt: '2026-09-01' }),
  ]
  return c
}
const ids = (c: ContentState, col: string) => cardsIn(c, col).map((k) => k.id)

describe('mover card', () => {
  it('leva para outra coluna na posição pedida', () => {
    const c = moveCard(board(), 'b', 'c-aprovado', 0)
    expect(ids(c, 'c-aprovado')).toEqual(['b', 'c'])
    expect(ids(c, 'c-ideias')).toEqual(['a', 'd'])
  })

  it('reordena dentro da mesma coluna e aceita índice além do fim', () => {
    const c = moveCard(board(), 'a', 'c-ideias', 99)
    expect(ids(c, 'c-ideias')).toEqual(['b', 'd', 'a'])
    expect(ids(moveCard(board(), 'd', 'c-ideias', 0), 'c-ideias')).toEqual(['d', 'a', 'b'])
  })

  it('soltar onde pegou não muda nada', () => {
    const c = board()
    expect(moveCard(c, 'b', 'c-ideias', 1)).toBe(c)
  })

  it('coluna inexistente ou card inexistente é ignorado', () => {
    const c = board()
    expect(moveCard(c, 'b', 'nao-existe', 0)).toBe(c)
    expect(moveCard(c, 'zzz', 'c-ideias', 0)).toBe(c)
  })

  it('coluna vazia recebe o card', () => {
    const c = moveCard(board(), 'a', 'c-producao', 0)
    expect(ids(c, 'c-producao')).toEqual(['a'])
  })
})

describe('colunas e campanhas', () => {
  it('apagar coluna manda os cards para a vizinha, nunca some card', () => {
    const c = removeColumn(board(), 'c-ideias')
    expect(c.columns.some((x) => x.id === 'c-ideias')).toBe(false)
    expect(c.cards).toHaveLength(5)
    expect(ids(c, 'c-aprovado')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('apagar campanha só solta os cards dela', () => {
    const c = board()
    c.campaigns = [
      { id: 'cp', name: 'X', color: 'pink', start: '', end: '', objective: '', notes: '' },
    ]
    c.cards[0].campaignId = 'cp'
    const out = removeCampaign(c, 'cp')
    expect(out.campaigns).toEqual([])
    expect(out.cards[0].campaignId).toBe('')
  })

  it('duplicar coloca a cópia logo abaixo, sem comentários nem aprovação', () => {
    const c = board()
    c.cards[0].comments = [
      { id: 'm', authorId: '', authorName: 'W', text: 'oi', at: '', kind: 'comentario' },
    ]
    c.cards[0].approval = { state: 'aprovado' }
    c.cards[0].checklist = [{ id: 'x', text: 'gravar', done: true }]
    const out = duplicateCard(c, 'a', 'a2', 'Wes')
    expect(ids(out, 'c-ideias')).toEqual(['a', 'a2', 'b', 'd'])
    const copy = out.cards.find((k) => k.id === 'a2')!
    expect(copy.comments).toEqual([])
    expect(copy.approval).toBeUndefined()
    expect(copy.checklist[0].done).toBe(false)
  })
})

describe('leitura defensiva', () => {
  it('lixo vira quadro com as colunas padrão', () => {
    const c = parseContent('nada')
    expect(c.columns.map((x) => x.name)).toEqual([
      'Ideias',
      'Aprovado',
      'Em produção',
      'Em revisão',
      'Programado',
      'Publicado',
    ])
    expect(c.cards).toEqual([])
  })

  it('card com coluna sumida cai na primeira; campos ruins são limpos', () => {
    const c = parseContent({
      columns: [{ id: 'x', name: 'Só uma', stage: 'idea', color: 'pink' }],
      cards: [
        {
          id: 'k',
          title: 'T',
          columnId: 'sumiu',
          format: 'inventado',
          networks: ['instagram', 'orkut', 'instagram'],
          publishAt: '31/12/2026',
          links: [{ id: 'l', url: 'javascript:alert(1)' }],
          attachments: [{ id: 'a', path: '' }],
          coverId: 'a',
        },
        { id: 'k', title: 'duplicado' },
      ],
    })
    expect(c.cards).toHaveLength(1)
    const k = c.cards[0]
    expect(k.columnId).toBe('x')
    expect(k.format).toBe('outro')
    expect(k.networks).toEqual(['instagram'])
    expect(k.publishAt).toBe('')
    expect(k.links).toEqual([])
    expect(k.attachments).toEqual([])
    expect(k.coverId).toBe('')
  })
})

describe('atrasos e filtro', () => {
  it('atrasado é passar da data sem estar em Publicado', () => {
    const c = board()
    c.cards[0].publishAt = '2026-09-20'
    expect(isLate(c, c.cards[0], '2026-09-25')).toBe(true)
    expect(isLate(c, c.cards[4], '2026-09-25')).toBe(false)
    c.cards[1].due = '2026-09-20'
    expect(isDueLate(c, c.cards[1], '2026-09-25')).toBe(true)
  })

  it('filtra por busca sem acento, formato, rede e responsável', () => {
    const k = { ...blankCard('k', 'c-ideias', ''), title: 'Reflexão de gestão', ownerIds: ['p1'] }
    expect(matchesFilter(k, { ...EMPTY_FILTER, q: 'reflexao' })).toBe(true)
    expect(matchesFilter(k, { ...EMPTY_FILTER, format: 'carrossel' })).toBe(false)
    expect(matchesFilter(k, { ...EMPTY_FILTER, network: 'instagram' })).toBe(true)
    expect(matchesFilter(k, { ...EMPTY_FILTER, ownerId: 'p2' })).toBe(false)
  })
})
