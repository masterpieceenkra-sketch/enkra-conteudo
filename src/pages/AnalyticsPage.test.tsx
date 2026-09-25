import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', async (orig) => ({
  ...(await orig<typeof import('../lib/supabase')>()),
  SYNC_ENABLED: true,
}))
vi.mock('../store/useNotifications', () => ({
  useNotifications: () => ({
    loading: false,
    error: null,
    rows: [
      {
        id: 1,
        kind: 'welcome',
        person_id: null,
        person_name: 'Gessica',
        status: 'sent',
        created_at: '2026-09-18T15:52:00Z',
      },
      {
        id: 2,
        kind: 'custom',
        person_id: null,
        person_name: 'Gessica',
        status: 'sent',
        created_at: '2026-09-18T16:00:00Z',
      },
      {
        id: 3,
        kind: 'welcome',
        person_id: null,
        person_name: 'Miguel',
        status: 'queued',
        created_at: '2026-09-18T16:10:00Z',
      },
    ],
  }),
}))
import {
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  STORAGE_KEY,
} from '../store/launchStore'
import { AnalyticsPage } from './AnalyticsPage'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})
afterEach(cleanup)

const mount = () =>
  render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  )

describe('AnalyticsPage', () => {
  it('mostra os blocos e os links de drill-down', () => {
    // o modelo nasce sem responsável; o bloco por pessoa precisa de pelo menos um
    const s = buildInitialState('2026-09-18')
    for (const t of allTasks(s).slice(0, 3)) t.owner = 'Comu'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument()
    for (const h of [
      'Estado das tarefas',
      'Progresso de cada fase',
      'Quem está com o quê',
      'Quanto está com cada um',
    ])
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Atrasadas/ })).toHaveAttribute(
      'href',
      '/checklist?filtro=atrasadas',
    )
    expect(screen.getByRole('link', { name: /Fase 1: Concepção/ })).toHaveAttribute(
      'href',
      '/checklist?fase=f1',
    )
    expect(screen.getByRole('link', { name: /^Comu$/ })).toHaveAttribute(
      'href',
      '/checklist?resp=t%3Acomu',
    )
    expect(screen.getByRole('img', { name: /Distribuição geral das tarefas/ })).toBeInTheDocument()
    // as sem responsável não viram barra (esmagariam as demais); viram link no cabeçalho
    expect(screen.getByRole('link', { name: /tarefas sem responsável/ })).toHaveAttribute(
      'href',
      '/checklist?resp=none',
    )
    expect(screen.queryByRole('link', { name: /^Sem responsável$/ })).toBeNull()
    // avisos no WhatsApp: totais e por pessoa
    expect(screen.getByRole('heading', { name: 'Avisos disparados' })).toBeInTheDocument()
    const wa = screen.getByRole('list', { name: 'Avisos por pessoa' })
    expect(wa.textContent).toMatch(/Gessica.*2 enviadas.*1 boas-vindas · 1 mensagem/s)
    expect(wa.textContent).toMatch(/Miguel.*0 enviadas · 1 na fila/s)
  })

  it('sem responsáveis mostra o estado vazio e esconde a carga', () => {
    const s = buildInitialState('2026-09-18')
    for (const t of allTasks(s)) t.owner = ''
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    mount()
    expect(screen.getByText(/Nenhuma tarefa tem responsável ainda/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Quanto está com cada um' })).toBeNull()
  })
})
