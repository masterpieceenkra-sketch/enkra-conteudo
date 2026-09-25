import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfirmProvider } from '../components/ConfirmProvider'
import { ToastProvider } from '../components/Toast'
import {
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  STORAGE_KEY,
} from '../store/launchStore'
import { ChecklistPage } from './ChecklistPage'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})
afterEach(cleanup)

/** Estado enxuto: uma fase, uma área, três tarefas (uma já concluída). */
function seed() {
  const s = buildInitialState('2026-09-18', 'blank')
  s.phases[0].areas[0].tasks = [
    { id: 't1', label: 'Escrever copy', done: false, owner: '', due: '' },
    { id: 't2', label: 'Gravar vídeo', done: true, owner: '', due: '' },
    { id: 't3', label: 'Subir página', done: false, owner: '', due: '' },
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  return s
}

const mount = (path = '/checklist') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ConfirmProvider>
          <ChecklistPage />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('ChecklistPage', () => {
  it('abre mostrando só o que falta e some com a tarefa assim que ela é marcada', () => {
    seed()
    mount()
    expect(screen.getByText('Escrever copy')).toBeInTheDocument()
    expect(screen.queryByText('Gravar vídeo')).toBeNull()

    fireEvent.click(screen.getByLabelText('Concluir: Escrever copy'))
    expect(screen.queryByText('Escrever copy')).toBeNull()
    // o aviso guarda a volta
    const desfazer = screen.getByRole('button', { name: 'Desfazer' })
    fireEvent.click(desfazer)
    expect(screen.getByText('Escrever copy')).toBeInTheDocument()
  })

  it('em "Todas" mostra tudo, com as concluídas no fim da área', () => {
    seed()
    mount('/checklist?filtro=todas')
    const lista = screen.getByRole('list', { name: '' }) as HTMLElement | null
    const itens = lista
      ? within(lista)
          .getAllByRole('listitem')
          .map((li) => li.textContent)
      : []
    const ordem = itens.length
      ? itens
      : screen
          .getAllByRole('checkbox')
          .map((c) => c.getAttribute('aria-label') ?? '')
          .filter((l) => l.startsWith('Concluir: '))
    expect(ordem.at(-1)).toContain('Gravar vídeo')
    expect(screen.getByText('Escrever copy')).toBeInTheDocument()
  })

  it('área com tudo concluído avisa em vez de sumir', () => {
    const s = buildInitialState('2026-09-18', 'blank')
    s.phases[0].areas[0].tasks = [
      { id: 't1', label: 'Feita', done: true, owner: '', due: '' },
      { id: 't2', label: 'Outra feita', done: true, owner: '', due: '' },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    expect(allTasks(s)).toHaveLength(2)
    mount()
    expect(screen.getByText(/Tudo feito por aqui/)).toBeInTheDocument()
  })

  it('vindo de um número da Analytics, abre direto a fase que tem o que mostrar', () => {
    // a atrasada fica numa fase que não é a atual, e as outras fases somem da lista
    const s = buildInitialState('2026-09-18')
    const ultima = s.phases.at(-1)!
    ultima.areas[0].tasks[0] = {
      ...ultima.areas[0].tasks[0],
      label: 'Tarefa esquecida',
      due: '2020-01-01',
      done: false,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    mount('/checklist?filtro=atrasadas')
    expect(screen.getByText('Tarefa esquecida')).toBeInTheDocument()
    expect(screen.getByText(ultima.name)).toBeInTheDocument()
    expect(screen.queryByText(s.phases[0].name)).toBeNull()
  })

  it('filtro sem resultado avisa uma vez, sem listar fases vazias', () => {
    const s = buildInitialState('2026-09-18')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    mount('/checklist?filtro=atrasadas')
    expect(screen.getByText('Nada para mostrar com esses filtros.')).toBeInTheDocument()
    expect(screen.queryByText(s.phases[0].name)).toBeNull()
  })
})
