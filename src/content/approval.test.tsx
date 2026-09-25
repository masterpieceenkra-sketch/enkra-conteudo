import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfirmProvider } from '../components/ConfirmProvider'
import { ToastProvider } from '../components/Toast'
import {
  CONTENT_MESSAGE_KINDS,
  DEFAULT_MESSAGE_TEMPLATES,
  defaultTemplate,
  fillTemplate,
  withBoardName,
} from '../data/messageTemplates'
import { __resetStoreForTests, buildInitialState, STORAGE_KEY } from '../store/launchStore'
import {
  addCard,
  blankCard,
  defaultContent,
  moveCard,
  pendingReview,
  withApprovalFor,
} from './model'
import { ApprovalsPage } from './pages/ApprovalsPage'

describe('aprovação acompanha a coluna', () => {
  it('entrar em coluna de aprovação abre rodada; sair antes de decidir cancela', () => {
    let c = defaultContent()
    c = withApprovalFor(addCard(c, blankCard('k', 'c-producao', 'Wes')), 'k')
    expect(c.cards[0].approval).toBeUndefined()
    c = withApprovalFor(moveCard(c, 'k', 'c-revisao', 0), 'k')
    expect(c.cards[0].approval).toEqual({ state: 'pendente' })
    expect(pendingReview(c).map((k) => k.id)).toEqual(['k'])
    c = withApprovalFor(moveCard(c, 'k', 'c-producao', 0), 'k')
    expect(c.cards[0].approval).toBeUndefined()
    expect(pendingReview(c)).toEqual([])
  })

  it('decisão anterior fica como histórico até a próxima rodada', () => {
    let c = defaultContent()
    c = addCard(c, { ...blankCard('k', 'c-programado', 'Wes'), approval: { state: 'aprovado' } })
    c = withApprovalFor(c, 'k')
    expect(c.cards[0].approval?.state).toBe('aprovado')
    c = withApprovalFor(moveCard(c, 'k', 'c-revisao', 0), 'k')
    expect(c.cards[0].approval?.state).toBe('pendente')
  })

  it('card novo criado em Ideias já entra na fila do cliente', () => {
    const c = withApprovalFor(addCard(defaultContent(), blankCard('k', 'c-ideias', 'Wes')), 'k')
    expect(pendingReview(c)).toHaveLength(1)
  })
})

describe('textos do hub de conteúdo', () => {
  it('boas-vindas do conteúdo são outras; o resto é igual em todo quadro', () => {
    expect(defaultTemplate('welcome', true)).toContain('hub de conteúdo')
    expect(defaultTemplate('welcome', false)).toBe(DEFAULT_MESSAGE_TEMPLATES.welcome)
    expect(defaultTemplate('card_assigned', true)).toBe(DEFAULT_MESSAGE_TEMPLATES.card_assigned)
  })

  it('decisão sem comentário some com a linha; {painel} vira o nome do quadro', () => {
    const t = withBoardName(DEFAULT_MESSAGE_TEMPLATES.content_decision, 'Estúdio Exemplo')
    const msg = fillTemplate(t, {
      nome: 'Ana',
      conteudo: 'Case de cliente',
      decisao: 'aprovado ✅',
      comentario: '',
      link: 'https://x/quadro?card=k1',
      autor: 'Bruno',
    })
    expect(msg).toBe(
      'Olá, Ana! O conteúdo *Case de cliente* foi aprovado ✅ por Bruno.\n\nAbrir card: https://x/quadro?card=k1\n\nEstúdio Exemplo 👋',
    )
  })

  it('todo aviso do conteúdo tem texto padrão e link', () => {
    for (const k of CONTENT_MESSAGE_KINDS) expect(defaultTemplate(k, true)).toContain('{link}')
  })
})

describe('tela Para aprovar (time)', () => {
  beforeEach(() => {
    __resetStoreForTests()
    localStorage.clear()
  })
  afterEach(cleanup)

  it('lista o que espera o cliente e o que voltou com ajuste', () => {
    const s = buildInitialState('2026-09-18', 'content')
    s.content!.cards = [
      {
        ...blankCard('k1', 'c-revisao', 'Wes'),
        title: 'Case de cliente',
        approval: { state: 'pendente' },
      },
      {
        ...blankCard('k2', 'c-revisao', 'Wes'),
        title: 'Diário #3',
        approval: { state: 'ajuste', note: 'Trocar a trilha' },
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    render(
      <MemoryRouter initialEntries={['/aprovar']}>
        <ToastProvider>
          <ConfirmProvider>
            <ApprovalsPage />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Case de cliente' })).toBeInTheDocument()
    expect(screen.getByText('Ajustes pedidos')).toBeInTheDocument()
    expect(screen.getByText('“Trocar a trilha”')).toBeInTheDocument()
    // o time não aprova pelo cliente
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
  })
})
