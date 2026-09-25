import type React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
import { StrategyPage } from './StrategyPage'
import { AnalyticsPage } from './AnalyticsPage'
import { blankCard } from '../model'
import { todayIso } from '../../lib/dates'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
  const s = buildInitialState('2026-09-18', 'content')
  s.content!.cards = [
    { ...blankCard('k1', 'c-programado', 'Wes'), title: 'Post de hoje', publishAt: todayIso() },
    {
      ...blankCard('k2', 'c-revisao', 'Wes'),
      title: 'Com o cliente',
      approval: { state: 'pendente' },
    },
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
})
afterEach(cleanup)

const mount = (el: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ConfirmProvider>{el}</ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('Estratégia', () => {
  it('nasce com os três pilares do funil e salva a meta de cadência', () => {
    mount(<StrategyPage />)
    expect(screen.getByDisplayValue('Alcance')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Autoridade')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Conversão')).toBeInTheDocument()
    const reels = screen.getByLabelText('Meta semanal de Reels')
    fireEvent.change(reels, { target: { value: '14' } })
    fireEvent.blur(reels)
    __flushForTests()
    expect(load().content!.strategy.cadence).toEqual([{ format: 'reels', perWeek: 14 }])
  })

  it('adiciona pilar no estágio certo', () => {
    mount(<StrategyPage />)
    fireEvent.click(screen.getByRole('button', { name: /Pilar de meio/ }))
    __flushForTests()
    const meio = load().content!.strategy.pillars.filter((p) => p.stage === 'meio')
    expect(meio).toHaveLength(2)
  })
})

describe('Analytics (início do time)', () => {
  it('mostra o post do dia e conta o que está com o cliente', () => {
    mount(<AnalyticsPage />)
    expect(screen.getByText('Post de hoje')).toBeInTheDocument()
    const kpi = screen.getByRole('link', { name: /Com o cliente/ })
    expect(kpi).toHaveTextContent('1')
  })
})
