import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfirmProvider } from '../../components/ConfirmProvider'
import { ToastProvider } from '../../components/Toast'
import {
  __flushForTests,
  __resetStoreForTests,
  buildInitialState,
  load,
  STORAGE_KEY,
} from '../../store/launchStore'
import { blankCard } from '../model'
import { BoardPage } from './BoardPage'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})
afterEach(cleanup)

function seed() {
  const s = buildInitialState('2026-09-18', 'content')
  s.content!.cards = [
    {
      ...blankCard('k1', 'c-ideias', 'Wes'),
      title: 'Livros para empreendedor',
      format: 'carrossel',
    },
    { ...blankCard('k2', 'c-producao', 'Wes'), title: 'Case de cliente', publishAt: '2020-01-01' },
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const mount = (path = '/quadro') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <ConfirmProvider>
          <BoardPage />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('Quadro de conteúdo', () => {
  it('mostra as colunas do fluxo com os cards de cada uma', () => {
    seed()
    mount()
    const ideias = screen.getByRole('region', { name: 'Ideias' })
    expect(within(ideias).getByText('Livros para empreendedor')).toBeInTheDocument()
    const prod = screen.getByRole('region', { name: 'Em produção' })
    expect(within(prod).getByText('Case de cliente')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Publicado' })).toBeInTheDocument()
  })

  it('cria card pelo rodapé da coluna', () => {
    seed()
    mount()
    const aprovado = screen.getByRole('region', { name: 'Aprovado' })
    fireEvent.click(within(aprovado).getByRole('button', { name: /Adicionar card/ }))
    const box = within(aprovado).getByPlaceholderText('Título do conteúdo')
    fireEvent.change(box, { target: { value: 'Photodump da semana' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    __flushForTests()
    const cards = load().content!.cards.filter((k) => k.columnId === 'c-aprovado')
    expect(cards.map((k) => k.title)).toEqual(['Photodump da semana'])
    expect(within(aprovado).getByText('Photodump da semana')).toBeInTheDocument()
  })

  it('a busca esconde o que não bate e conta o resultado', () => {
    seed()
    mount()
    fireEvent.change(screen.getByPlaceholderText(/Buscar título/), { target: { value: 'case' } })
    expect(screen.queryByText('Livros para empreendedor')).toBeNull()
    expect(screen.getByText('Case de cliente')).toBeInTheDocument()
    expect(screen.getByText('1 card com esses filtros')).toBeInTheDocument()
  })

  it('abre o card pela URL e edita o título', () => {
    seed()
    mount('/quadro?card=k1')
    const title = screen.getByLabelText('Título')
    fireEvent.change(title, { target: { value: '5 livros para empreendedor' } })
    __flushForTests()
    expect(load().content!.cards[0].title).toBe('5 livros para empreendedor')
  })
})
