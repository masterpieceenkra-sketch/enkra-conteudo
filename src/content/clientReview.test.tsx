import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmProvider } from '../components/ConfirmProvider'
import { ToastProvider } from '../components/Toast'
import { __resetStoreForTests, buildInitialState, STORAGE_KEY } from '../store/launchStore'
import { blankCard } from './model'
import { ApprovalsPage } from './pages/ApprovalsPage'

const review = vi.fn(async () => {})
vi.mock('./roles', () => ({ useIsClient: () => true }))
vi.mock('./review', () => ({
  reviewCard: (...args: unknown[]) => review(...(args as [])),
  notifyPendingReview: async () => 0,
}))

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
  review.mockClear()
  const s = buildInitialState('2026-09-18', 'content')
  s.content!.cards = [
    {
      ...blankCard('k1', 'c-revisao', 'Wes'),
      title: 'Case de cliente',
      caption: 'Legenda do post',
      approval: { state: 'pendente' },
    },
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
})
afterEach(cleanup)

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/aprovar']}>
      <ToastProvider>
        <ConfirmProvider>
          <ApprovalsPage />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('cliente na fila de aprovação', () => {
  it('aprova com um clique', async () => {
    mount()
    expect(screen.getByText('Legenda do post')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(review).toHaveBeenCalledWith('k1', 'aprovado', ''))
  })

  it('pedir ajuste exige escrever o que muda', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: /Pedir ajuste/ }))
    const send = screen.getByRole('button', { name: /Enviar pedido de ajuste/ })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText('O que precisa mudar?'), {
      target: { value: 'Trocar a capa' },
    })
    fireEvent.click(send)
    await waitFor(() => expect(review).toHaveBeenCalledWith('k1', 'ajuste', 'Trocar a capa'))
  })
})
