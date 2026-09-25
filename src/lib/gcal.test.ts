import { describe, expect, it } from 'vitest'
import { buildInitialState } from '../store/launchStore'
import { buildIcs, googleCalendarUrl, meetingEvent, milestoneEvent, stateToEvents } from './gcal'

describe('Google Agenda / iCalendar', () => {
  it('gera link do Google para evento com hora (fuso local) e dia inteiro', () => {
    const timed = googleCalendarUrl(
      meetingEvent({
        id: 'r1',
        title: 'Call',
        date: '2026-10-02',
        time: '14:30',
        durationMin: 45,
        link: 'https://meet.google.com/x',
        agenda: 'Pauta',
      }),
    )
    const u = new URL(timed)
    expect(u.searchParams.get('action')).toBe('TEMPLATE')
    expect(u.searchParams.get('text')).toBe('Call')
    expect(u.searchParams.get('dates')).toBe('20261002T143000/20261002T151500')
    expect(u.searchParams.get('location')).toBe('https://meet.google.com/x')
    expect(u.searchParams.get('details')).toContain('Pauta')

    const allDay = new URL(
      googleCalendarUrl(milestoneEvent({ id: 'm1', label: 'CPL 1', date: '2026-10-16' })),
    )
    expect(allDay.searchParams.get('dates')).toBe('20261016/20261017')
    expect(allDay.searchParams.get('text')).toBe('Marco: CPL 1')
  })

  it('monta .ics válido com fases multi-dia, marcos e reuniões, escapando e dobrando linhas', () => {
    const s = buildInitialState('2026-09-18')
    s.meetings.push({
      id: 'r1',
      title: 'Call; com, vírgula',
      date: '2026-10-02',
      time: '09:00',
      durationMin: 60,
      link: '',
      agenda: 'linha 1\nlinha 2',
    })
    const events = stateToEvents(s)
    expect(events.filter((e) => e.uid.startsWith('phase-'))).toHaveLength(7)
    expect(events.filter((e) => e.uid.startsWith('milestone-'))).toHaveLength(8)
    const ics = buildIcs(events)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
    // fase 1: 18/09 a 24/09 → DTEND exclusivo em 25/09
    expect(ics).toContain('DTSTART;VALUE=DATE:20260918\r\nDTEND;VALUE=DATE:20260925')
    const BS = String.fromCharCode(92)
    expect(ics).toContain(`SUMMARY:Call${BS}; com${BS}, vírgula`)
    expect(ics).toContain(`DESCRIPTION:linha 1${BS}nlinha 2`)
    expect(ics).toContain('DTSTART:20261002T090000\r\nDTEND:20261002T100000')
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })

  it('ignora fases e marcos sem data válida', () => {
    const s = buildInitialState()
    s.phases[0].end = ''
    s.milestones[0].date = 'x'
    const events = stateToEvents(s)
    expect(events.some((e) => e.uid === 'phase-f1')).toBe(false)
    expect(events.some((e) => e.uid === 'milestone-m1')).toBe(false)
  })
})
