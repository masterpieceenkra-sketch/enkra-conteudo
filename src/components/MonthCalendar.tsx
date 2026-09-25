import { useMemo } from 'react'
import { phaseColor } from '../data/phaseColors'
import type { Meeting, Milestone, Phase } from '../data/types'
import { addDays, diffDays, isValidIso } from '../lib/dates'

interface Props {
  phases: Phase[]
  milestones: Milestone[]
  meetings: Meeting[]
  today: string
  /** intervalo a exibir (inclusive) */
  from: string
  to: string
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Calendário mensal: cada dia pintado com a cor da fase, com marcos e reuniões. */
export function MonthCalendar({ phases, milestones, meetings, today, from, to }: Props) {
  const phaseByDay = useMemo(() => {
    const map = new Map<string, number>()
    phases.forEach((p, i) => {
      if (!isValidIso(p.start) || !isValidIso(p.end) || p.end < p.start) return
      const n = diffDays(p.start, p.end)
      if (n > 400) return
      for (let d = 0; d <= n; d++) {
        const iso = addDays(p.start, d)
        if (!map.has(iso)) map.set(iso, i)
      }
    })
    return map
  }, [phases])

  const byDay = useMemo(() => {
    const ms = new Map<string, Milestone[]>()
    for (const m of milestones)
      if (isValidIso(m.date)) ms.set(m.date, [...(ms.get(m.date) ?? []), m])
    const rs = new Map<string, Meeting[]>()
    for (const r of meetings) if (isValidIso(r.date)) rs.set(r.date, [...(rs.get(r.date) ?? []), r])
    for (const list of rs.values()) list.sort((a, b) => a.time.localeCompare(b.time))
    return { ms, rs }
  }, [milestones, meetings])

  const months = useMemo(() => {
    const out: { key: string; year: number; month: number }[] = []
    const start = new Date(`${from}T12:00:00`)
    const end = new Date(`${to}T12:00:00`)
    const cur = new Date(start.getFullYear(), start.getMonth(), 1, 12)
    while (cur <= end && out.length < 18) {
      out.push({
        key: `${cur.getFullYear()}-${cur.getMonth()}`,
        year: cur.getFullYear(),
        month: cur.getMonth(),
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return out
  }, [from, to])

  return (
    <div className="grid gap-6">
      {months.map((m) => (
        <MonthGrid
          key={m.key}
          year={m.year}
          month={m.month}
          today={today}
          phaseByDay={phaseByDay}
          phases={phases}
          milestonesByDay={byDay.ms}
          meetingsByDay={byDay.rs}
        />
      ))}
    </div>
  )
}

function MonthGrid({
  year,
  month,
  today,
  phaseByDay,
  phases,
  milestonesByDay,
  meetingsByDay,
}: {
  year: number
  month: number
  today: string
  phaseByDay: Map<string, number>
  phases: Phase[]
  milestonesByDay: Map<string, Milestone[]>
  meetingsByDay: Map<string, Meeting[]>
}) {
  const first = new Date(year, month, 1, 12)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = first.getDay()
  const raw = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const title = raw.charAt(0).toUpperCase() + raw.slice(1)
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7) cells.push(null)

  return (
    <section aria-label={title}>
      <h3 className="font-display text-base font-bold tracking-[-0.02em] sm:text-lg">{title}</h3>
      <div className="mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="bg-surface-2 py-1 text-center text-[11px] font-semibold text-muted-foreground"
            aria-hidden
          >
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null)
            return <div key={`e${i}`} className="min-h-12 bg-surface/60 sm:min-h-20" />
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const pi = phaseByDay.get(iso)
          const color = pi !== undefined ? phaseColor(pi) : null
          const isToday = iso === today
          const ms = milestonesByDay.get(iso) ?? []
          const rs = meetingsByDay.get(iso) ?? []
          const phaseName = pi !== undefined ? phases[pi]?.name : undefined
          return (
            <div
              key={iso}
              title={phaseName}
              className={`relative min-h-12 bg-surface p-1 sm:min-h-20 sm:p-1.5 ${isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
              style={
                color
                  ? {
                      boxShadow: `inset 3px 0 0 ${color.bg}`,
                      background: `color-mix(in oklab, ${color.bg} 14%, var(--surface))`,
                    }
                  : undefined
              }
            >
              <span
                className={`text-xs font-semibold ${isToday ? 'rounded bg-primary px-1 text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {day}
              </span>
              <div className="mt-0.5 hidden gap-0.5 sm:grid">
                {ms.map((m) => (
                  <span
                    key={m.id}
                    className="truncate rounded bg-lime px-1 text-[10px] font-bold text-lime-foreground"
                    title={m.label}
                  >
                    ◆ {m.label}
                  </span>
                ))}
                {rs.map((r) => (
                  <span
                    key={r.id}
                    className="truncate rounded bg-aqua/80 px-1 text-[10px] font-semibold text-aqua-foreground"
                    title={`${r.time ? r.time + ' · ' : ''}${r.title}`}
                  >
                    {r.time ? `${r.time} ` : ''}
                    {r.title}
                  </span>
                ))}
              </div>
              {ms.length + rs.length > 0 ? (
                <div
                  className="mt-0.5 flex gap-0.5 sm:hidden"
                  aria-label={`${ms.length} marcos, ${rs.length} reuniões`}
                >
                  {ms.map((m) => (
                    <span key={m.id} className="size-1.5 rotate-45 bg-lime" />
                  ))}
                  {rs.map((r) => (
                    <span key={r.id} className="size-1.5 rounded-full bg-aqua" />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
