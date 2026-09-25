import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStoreForTests,
  buildInitialState,
  parseState,
  upcomingMeetings,
  useLaunchActions,
  useLaunchState,
} from './launchStore'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})

describe('reuniões', () => {
  it('cria, edita e remove; valida título, data, hora e link', () => {
    const { result } = renderHook(() => ({ state: useLaunchState(), actions: useLaunchActions() }))
    let id = ''
    act(() => {
      expect(
        result.current.actions.addMeeting({
          title: '  ',
          date: '2026-10-02',
          time: '',
          durationMin: 60,
          link: '',
          agenda: '',
        }),
      ).toBe('')
      expect(
        result.current.actions.addMeeting({
          title: 'Call',
          date: 'ontem',
          time: '',
          durationMin: 60,
          link: '',
          agenda: '',
        }),
      ).toBe('')
      expect(
        result.current.actions.addMeeting({
          title: 'Call',
          date: '2026-10-02',
          time: '',
          durationMin: 60,
          link: 'meet',
          agenda: '',
        }),
      ).toBe('')
      id = result.current.actions.addMeeting({
        title: ' Call de concepção ',
        date: '2026-10-02',
        time: '25:00',
        durationMin: 0,
        link: ' https://meet.google.com/abc ',
        agenda: 'Pauta',
      })
    })
    expect(result.current.state.meetings).toEqual([
      {
        id,
        title: 'Call de concepção',
        date: '2026-10-02',
        time: '',
        durationMin: 60,
        link: 'https://meet.google.com/abc',
        agenda: 'Pauta',
      },
    ])
    act(() => result.current.actions.patchMeeting(id, { time: '14:00', durationMin: 30 }))
    expect(result.current.state.meetings[0]).toMatchObject({ time: '14:00', durationMin: 30 })
    act(() => result.current.actions.patchMeeting(id, { date: '' }))
    expect(result.current.state.meetings[0].date).toBe('2026-10-02')
    // resumo colado depois da reunião: guardado aparado, e removido quando fica vazio
    act(() => result.current.actions.patchMeeting(id, { summary: '  Ata da call  ' }))
    expect(result.current.state.meetings[0].summary).toBe('Ata da call')
    act(() => result.current.actions.patchMeeting(id, { summary: '   ' }))
    expect(result.current.state.meetings[0].summary).toBeUndefined()
    act(() => result.current.actions.removeMeeting(id))
    expect(result.current.state.meetings).toEqual([])
  })

  it('lista as próximas em ordem de data e hora', () => {
    const s = buildInitialState()
    s.meetings = [
      {
        id: 'a',
        title: 'B',
        date: '2026-10-02',
        time: '15:00',
        durationMin: 60,
        link: '',
        agenda: '',
      },
      {
        id: 'b',
        title: 'A',
        date: '2026-10-02',
        time: '09:00',
        durationMin: 60,
        link: '',
        agenda: '',
      },
      {
        id: 'c',
        title: 'Passada',
        date: '2026-09-01',
        time: '',
        durationMin: 60,
        link: '',
        agenda: '',
      },
      {
        id: 'd',
        title: 'Hoje',
        date: '2026-09-17',
        time: '',
        durationMin: 60,
        link: '',
        agenda: '',
      },
    ]
    expect(upcomingMeetings(s, '2026-09-17').map((m) => m.id)).toEqual(['d', 'b', 'a'])
  })

  it('import valida reuniões e estado antigo sem o campo recebe lista vazia', () => {
    const s = buildInitialState()
    const raw = JSON.parse(JSON.stringify(s))
    delete raw.meetings
    expect(parseState(raw).meetings).toEqual([])
    raw.meetings = [
      {
        id: 'x',
        title: 'Ok',
        date: '2026-10-02',
        time: '9:00',
        durationMin: 99999,
        link: 'ftp://x',
        agenda: 5,
      },
      { id: 'x', title: 'dup', date: '2026-10-02' },
      { id: 'y', title: 'sem data' },
    ]
    expect(parseState(raw).meetings).toEqual([
      { id: 'x', title: 'Ok', date: '2026-10-02', time: '', durationMin: 60, link: '', agenda: '' },
    ])
  })
})
