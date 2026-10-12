import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewBoardPage } from './NewBoardPage'

vi.mock('../lib/auth', () => ({ sessionPhone: () => '5511999990000' }))
vi.mock('../store/boards', () => ({
  usePlatformOwner: () => true,
  slugAvailable: async () => true,
  createBoard: async (id: string) => id,
}))

afterEach(cleanup)

function setup() {
  render(
    <MemoryRouter>
      <NewBoardPage />
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByPlaceholderText('Ex.: Estúdio Aurora'), {
    target: { value: 'Enkra' },
  })
  fireEvent.change(screen.getByPlaceholderText('Seu nome'), { target: { value: 'Ana' } })
  return {
    clientName: screen.getByPlaceholderText('Nome'),
    clientPhone: screen.getByPlaceholderText('(99) 99999-9999'),
    submit: screen.getByRole('button', { name: /criar quadro/i }),
  }
}

describe('NewBoardPage · cliente opcional', () => {
  it('cria sem o cliente quando os dois campos ficam vazios', async () => {
    const { submit } = setup()
    expect(await screen.findByText(/endereço livre/i)).toBeTruthy()
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('ignora o próprio WhatsApp repetido no campo do cliente', async () => {
    const { clientPhone, submit } = setup()
    fireEvent.change(clientPhone, { target: { value: '11999990000' } })
    await screen.findByText(/endereço livre/i)
    expect(screen.getByText(/já é o seu/i)).toBeTruthy()
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('explica o que falta quando só o número do cliente foi preenchido', async () => {
    const { clientPhone, submit } = setup()
    fireEvent.change(clientPhone, { target: { value: '85999990000' } })
    await screen.findByText(/endereço livre/i)
    expect(screen.getByRole('alert').textContent).toMatch(/falta o nome/i)
    expect((submit as HTMLButtonElement).disabled).toBe(true)
  })
})
