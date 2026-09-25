import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dragResult } from '../lib/ganttDrag'
import { GanttChart } from './GanttChart'

afterEach(cleanup)

const phases = [
  { id: 'f1', name: 'Fase 1', start: '2026-09-14', end: '2026-09-18', areas: [] },
  { id: 'f2', name: 'Fase 2', start: '2026-09-21', end: '2026-09-24', areas: [] },
]

function mount(onPhaseChange?: (id: string, patch: { start: string; end: string }) => void) {
  return render(
    <MemoryRouter>
      <GanttChart
        phases={phases}
        milestones={[]}
        meetings={[]}
        today="2026-09-16"
        from="2026-09-14"
        to="2026-09-24"
        onPhaseChange={onPhaseChange}
      />
    </MemoryRouter>,
  )
}

describe('dragResult', () => {
  it('mover desloca início e fim juntos', () => {
    expect(
      dragResult({
        id: 'f1',
        mode: 'move',
        originX: 0,
        start: '2026-09-14',
        end: '2026-09-18',
        delta: 3,
      }),
    ).toEqual({ start: '2026-09-17', end: '2026-09-21' })
  })
  it('puxar a borda não cruza a outra', () => {
    expect(
      dragResult({
        id: 'f1',
        mode: 'start',
        originX: 0,
        start: '2026-09-14',
        end: '2026-09-18',
        delta: 9,
      }),
    ).toEqual({ start: '2026-09-18', end: '2026-09-18' })
    expect(
      dragResult({
        id: 'f1',
        mode: 'end',
        originX: 0,
        start: '2026-09-14',
        end: '2026-09-18',
        delta: -9,
      }),
    ).toEqual({ start: '2026-09-14', end: '2026-09-14' })
  })
})

describe('GanttChart arrastável', () => {
  it('arrastar a barra 2 dias chama onPhaseChange com as novas datas', () => {
    const onPhaseChange = vi.fn()
    mount(onPhaseChange)
    const bar = screen.getByTitle(/^Fase 1:/)
    fireEvent.pointerDown(bar, { button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 100 + 28 * 2, pointerId: 1 })
    fireEvent.pointerUp(bar, { pointerId: 1 })
    expect(onPhaseChange).toHaveBeenCalledWith('f1', { start: '2026-09-16', end: '2026-09-20' })
  })
  it('puxar a borda direita muda só o fim', () => {
    const onPhaseChange = vi.fn()
    mount(onPhaseChange)
    const bar = screen.getByTitle(/^Fase 2:/)
    const handle = bar.querySelector('[data-handle="end"]')!
    fireEvent.pointerDown(handle, { button: 0, clientX: 300, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 300 + 28, pointerId: 1 })
    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(onPhaseChange).toHaveBeenCalledWith('f2', { start: '2026-09-21', end: '2026-09-25' })
  })
  it('soltar no mesmo lugar não grava nada', () => {
    const onPhaseChange = vi.fn()
    mount(onPhaseChange)
    const bar = screen.getByTitle(/^Fase 1:/)
    fireEvent.pointerDown(bar, { button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 105, pointerId: 1 })
    fireEvent.pointerUp(bar, { pointerId: 1 })
    expect(onPhaseChange).not.toHaveBeenCalled()
  })
  it('sem onPhaseChange a barra não tem alças', () => {
    mount()
    expect(screen.getByTitle(/^Fase 1:/).querySelector('[data-handle]')).toBeNull()
  })
})
