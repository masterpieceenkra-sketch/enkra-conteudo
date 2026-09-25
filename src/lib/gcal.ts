import type { LaunchState } from '../data/types'
import { addDays, isValidIso } from './dates'

export interface CalendarEvent {
  /** identificador estável para o .ics */
  uid: string
  title: string
  /** ISO yyyy-mm-dd */
  date: string
  /** último dia (inclusive) de um evento de dia inteiro com vários dias */
  endDate?: string
  /** HH:mm; vazio ou ausente = dia inteiro */
  time?: string
  durationMin?: number
  details?: string
  location?: string
}

const compact = (iso: string) => iso.replace(/-/g, '')
const pad = (n: number) => String(n).padStart(2, '0')

/** Início/fim no formato do Google e do iCalendar, sempre no fuso local. */
function bounds(e: CalendarEvent): { start: string; end: string; allDay: boolean } {
  if (!e.time) {
    // dia inteiro: o fim é exclusivo, então cai no dia seguinte ao último
    const last = e.endDate && e.endDate >= e.date ? e.endDate : e.date
    return { start: compact(e.date), end: compact(addDays(last, 1)), allDay: true }
  }
  const [h, m] = e.time.split(':').map(Number)
  const start = new Date(`${e.date}T${pad(h)}:${pad(m)}:00`)
  const end = new Date(start.getTime() + (e.durationMin ?? 60) * 60_000)
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  return { start: fmt(start), end: fmt(end), allDay: false }
}

/** Link "Adicionar ao Google Agenda": abre o Google com o evento pré-preenchido. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const b = bounds(e)
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${b.start}/${b.end}` })
  if (e.details) p.set('details', e.details)
  if (e.location) p.set('location', e.location)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function icsEscape(s: string): string {
  const BS = String.fromCharCode(92)
  return s
    .split(BS)
    .join(BS + BS)
    .split(';')
    .join(BS + ';')
    .split(',')
    .join(BS + ',')
    .replace(/\r?\n/g, BS + 'n')
}

/** Dobra linhas com mais de 75 octetos, como o iCalendar exige. */
function fold(line: string): string[] {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out
}

/** Arquivo .ics com todos os eventos (importável no Google Agenda, Apple e Outlook). */
export function buildIcs(events: CalendarEvent[], calendarName = 'GPS do Lançamento'): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comu HUB//GPS do Lançamento//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ]
  for (const e of events) {
    const b = bounds(e)
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@gps-lancamento`, `DTSTAMP:${stamp}`)
    if (b.allDay) lines.push(`DTSTART;VALUE=DATE:${b.start}`, `DTEND;VALUE=DATE:${b.end}`)
    else lines.push(`DTSTART:${b.start}`, `DTEND:${b.end}`)
    lines.push(`SUMMARY:${icsEscape(e.title)}`)
    if (e.details) lines.push(`DESCRIPTION:${icsEscape(e.details)}`)
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.flatMap(fold).join('\r\n')
}

export function milestoneEvent(m: { id: string; label: string; date: string }): CalendarEvent {
  return {
    uid: `milestone-${m.id}`,
    title: `Marco: ${m.label}`,
    date: m.date,
    details: 'Marco do lançamento · GPS do Lançamento',
  }
}

export function meetingEvent(r: {
  id: string
  title: string
  date: string
  time: string
  durationMin: number
  link: string
  agenda: string
}): CalendarEvent {
  return {
    uid: `meeting-${r.id}`,
    title: r.title,
    date: r.date,
    time: r.time || undefined,
    durationMin: r.durationMin,
    details: [r.agenda.trim(), r.link].filter(Boolean).join('\n\n'),
    location: r.link || undefined,
  }
}

/** Fases (dia inteiro, do início ao fim), marcos e reuniões do estado atual. */
export function stateToEvents(s: LaunchState): CalendarEvent[] {
  const events: CalendarEvent[] = []
  for (const p of s.phases) {
    if (!isValidIso(p.start) || !isValidIso(p.end) || p.end < p.start) continue
    events.push({
      uid: `phase-${p.id}`,
      title: p.name,
      date: p.start,
      endDate: p.end,
      details: 'Fase do lançamento · GPS do Lançamento',
    })
  }
  for (const m of s.milestones) if (isValidIso(m.date)) events.push(milestoneEvent(m))
  for (const r of s.meetings) if (isValidIso(r.date)) events.push(meetingEvent(r))
  return events
}
