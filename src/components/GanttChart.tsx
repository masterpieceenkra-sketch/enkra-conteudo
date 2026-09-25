import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { phaseColor } from '../data/phaseColors'
import type { Meeting, Milestone, Phase } from '../data/types'
import { addDays, diffDays, formatBr, isValidIso } from '../lib/dates'
import { dragResult, type Drag } from '../lib/ganttDrag'

interface Props {
  phases: Phase[]
  milestones: Milestone[]
  meetings: Meeting[]
  today: string
  from: string
  to: string
  /** Quando informado, as barras das fases podem ser arrastadas (mover) ou puxadas pelas bordas (início/fim). */
  onPhaseChange?: (phaseId: string, patch: { start: string; end: string }) => void
}

const DAY_PX = 28
const LABEL_W = 176

export function GanttChart({
  phases,
  milestones,
  meetings,
  today,
  from,
  to,
  onPhaseChange,
}: Props) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const suppressClick = useRef(false)
  const m = useMemo(() => {
    // Começa na segunda-feira da semana de `from` e termina no domingo da semana de `to`.
    const startDow = new Date(`${from}T12:00:00`).getDay()
    const start = addDays(from, -((startDow + 6) % 7))
    const endDow = new Date(`${to}T12:00:00`).getDay()
    const end = addDays(to, (7 - endDow) % 7)
    const days = diffDays(start, end) + 1
    const x = (iso: string) => diffDays(start, iso) * DAY_PX

    const weeks: { iso: string; x: number }[] = []
    for (let d = 0; d < days; d += 7) weeks.push({ iso: addDays(start, d), x: d * DAY_PX })

    const months: { label: string; x: number; w: number }[] = []
    let cursor = start
    while (cursor <= end) {
      const dt = new Date(`${cursor}T12:00:00`)
      const monthEnd = new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 12)
      const endIso =
        monthEnd.toISOString().slice(0, 10) < end ? monthEnd.toISOString().slice(0, 10) : end
      const raw = dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      months.push({
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
        x: x(cursor),
        w: (diffDays(cursor, endIso) + 1) * DAY_PX,
      })
      cursor = addDays(endIso, 1)
    }

    const weekends: number[] = []
    for (let d = 0; d < days; d++) {
      const dow = (startDow + 6 + d) % 7 // 0 = segunda
      if (dow >= 5) weekends.push(d * DAY_PX)
    }

    return { start, end, days, width: days * DAY_PX, x, weeks, months, weekends }
  }, [from, to])

  const todayX = today >= m.start && today <= m.end ? m.x(today) + DAY_PX / 2 : null
  const scrollRef = useRef<HTMLDivElement>(null)

  // Ao abrir, deixa a semana de hoje visível no primeiro terço da área.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || todayX === null) return
    el.scrollLeft = Math.max(0, todayX - (el.clientWidth - LABEL_W) / 3)
  }, [todayX])
  const sortedMilestones = [...milestones]
    .filter((ms) => isValidIso(ms.date))
    .sort((a, b) => a.date.localeCompare(b.date))
  const sortedMeetings = [...meetings]
    .filter((r) => isValidIso(r.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-lg border border-border">
      <div className="relative" style={{ width: LABEL_W + m.width, minWidth: '100%' }}>
        {/* Cabeçalho: meses + semanas */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface-2">
          <div className="flex">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              style={{ width: LABEL_W }}
            >
              Fase
            </div>
            <div className="relative h-11 flex-1">
              {m.months.map((mo) => (
                <div
                  key={mo.label}
                  className="absolute top-0 h-5 truncate border-l border-border px-2 text-[11px] font-bold uppercase tracking-wider"
                  style={{ left: mo.x, width: mo.w }}
                  title={mo.label}
                >
                  {mo.w >= 90 ? mo.label : ''}
                </div>
              ))}
              {m.weeks.map((w) => (
                <div
                  key={w.iso}
                  className="absolute top-5 h-6 border-l border-border pl-1 text-[10px] leading-6 text-muted-foreground"
                  style={{ left: w.x }}
                >
                  {formatBr(w.iso).slice(0, 5)}
                </div>
              ))}
              {todayX !== null ? (
                <span
                  className="absolute top-6 -translate-x-1/2 rounded bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground"
                  style={{ left: todayX }}
                >
                  hoje
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Fundo: fins de semana + linha de hoje (cobre todas as linhas) */}
        <div
          className="pointer-events-none absolute inset-y-0 z-0"
          style={{ left: LABEL_W, width: m.width }}
          aria-hidden
        >
          {m.weekends.map((wx) => (
            <div
              key={wx}
              className="absolute inset-y-0 bg-foreground/[0.035]"
              style={{ left: wx, width: DAY_PX }}
            />
          ))}
          {m.weeks.map((w) => (
            <div
              key={w.iso}
              className="absolute inset-y-0 border-l border-border/60"
              style={{ left: w.x }}
            />
          ))}
          {todayX !== null ? (
            <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: todayX }} />
          ) : null}
        </div>

        {/* Linhas de fase */}
        <div className="relative z-10">
          {phases.map((p, i) => {
            const valid = isValidIso(p.start) && isValidIso(p.end) && p.end >= p.start
            const c = phaseColor(i)
            const current = valid && p.start <= today && today <= p.end
            const preview = drag && drag.id === p.id ? dragResult(drag) : null
            const start = preview?.start ?? p.start
            const end = preview?.end ?? p.end
            const editable = !!onPhaseChange && valid
            return (
              <div key={p.id} className="flex border-b border-border/60">
                <div
                  className={`sticky left-0 z-20 shrink-0 border-r border-border bg-surface px-3 py-2 text-xs ${current ? 'font-bold' : 'font-medium'}`}
                  style={{ width: LABEL_W }}
                >
                  <span
                    className="mr-1.5 inline-block size-2.5 rounded-sm align-middle"
                    style={{ background: c.bg }}
                    aria-hidden
                  />
                  <span className="align-middle">{p.name}</span>
                  {valid ? (
                    <span className="block pl-4 text-[10px] font-normal text-muted-foreground">
                      {diffDays(p.start, p.end) + 1} dias
                    </span>
                  ) : null}
                </div>
                <div className="relative h-11 flex-1">
                  {valid ? (
                    <Link
                      to={`/checklist?fase=${p.id}`}
                      title={
                        editable
                          ? `${p.name}: ${formatBr(start)} → ${formatBr(end)} · arraste para mover, puxe as bordas para mudar início ou fim`
                          : `${p.name}: ${formatBr(start)} → ${formatBr(end)}`
                      }
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={(e) => {
                        if (suppressClick.current) {
                          e.preventDefault()
                          suppressClick.current = false
                        }
                      }}
                      onPointerDown={(e) => {
                        if (!editable || e.button !== 0) return
                        const handle = (e.target as HTMLElement).dataset.handle
                        const mode = handle === 'start' || handle === 'end' ? handle : 'move'
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId)
                        } catch {
                          // sem captura (jsdom ou pointerId inválido): o arrasto ainda funciona dentro da barra
                        }
                        setDrag({
                          id: p.id,
                          mode,
                          originX: e.clientX,
                          start: p.start,
                          end: p.end,
                          delta: 0,
                        })
                      }}
                      onPointerMove={(e) => {
                        if (!drag || drag.id !== p.id) return
                        const delta = Math.round((e.clientX - drag.originX) / DAY_PX)
                        if (delta !== drag.delta) setDrag({ ...drag, delta })
                      }}
                      onPointerUp={() => {
                        if (!drag || drag.id !== p.id) return
                        const r = dragResult(drag)
                        if (r.start !== p.start || r.end !== p.end) {
                          suppressClick.current = true
                          onPhaseChange?.(p.id, r)
                        } else if (drag.delta !== 0) suppressClick.current = true
                        setDrag(null)
                      }}
                      onPointerCancel={() => setDrag(null)}
                      className={`absolute top-2 flex h-7 select-none items-center overflow-hidden rounded-md px-2 text-[11px] font-bold uppercase tracking-wider transition-[filter] hover:brightness-110 ${current ? 'ring-2 ring-foreground' : ''} ${
                        editable
                          ? drag?.id === p.id
                            ? 'cursor-grabbing shadow-lg'
                            : 'cursor-grab'
                          : ''
                      }`}
                      style={{
                        left: m.x(start),
                        width: (diffDays(start, end) + 1) * DAY_PX,
                        background: c.bg,
                        color: c.fg,
                        touchAction: editable ? 'none' : undefined,
                      }}
                    >
                      {editable ? (
                        <>
                          <span
                            data-handle="start"
                            className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize"
                            aria-hidden
                          />
                          <span
                            data-handle="end"
                            className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize"
                            aria-hidden
                          />
                        </>
                      ) : null}
                      <span className="truncate">
                        {formatBr(start).slice(0, 5)} → {formatBr(end).slice(0, 5)}
                      </span>
                    </Link>
                  ) : (
                    <span className="absolute top-3 left-2 text-[11px] text-danger">
                      datas inválidas
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Marcos */}
          <div className="flex border-b border-border/60">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface px-3 py-2 text-xs font-semibold"
              style={{ width: LABEL_W }}
            >
              <span
                className="mr-1.5 inline-block size-2.5 rotate-45 rounded-[2px] bg-lime align-middle"
                aria-hidden
              />
              Marcos
              <span className="block pl-4 text-[10px] font-normal text-muted-foreground">
                {sortedMilestones.length}
              </span>
            </div>
            <div className="relative min-h-11 flex-1 py-1">
              {sortedMilestones.map((ms, i) => (
                <div
                  key={ms.id}
                  className="flex h-6 items-center"
                  title={`${ms.label} · ${formatBr(ms.date)}`}
                >
                  <span
                    className={`absolute size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] ring-2 ring-surface ${ms.date < today ? 'bg-muted-foreground' : 'bg-lime'}`}
                    style={{ left: m.x(ms.date) + DAY_PX / 2 }}
                    aria-hidden
                  />
                  <span
                    className={`absolute whitespace-nowrap text-[10px] ${ms.date < today ? 'text-muted-foreground' : 'font-semibold'}`}
                    style={{ left: m.x(ms.date) + DAY_PX / 2 + 10, top: i * 24 + 6 }}
                  >
                    {ms.label}{' '}
                    <span className="font-normal text-muted-foreground">
                      {formatBr(ms.date).slice(0, 5)}
                    </span>
                  </span>
                </div>
              ))}
              {sortedMilestones.length === 0 ? (
                <span className="px-2 text-[11px] text-muted-foreground">Nenhum marco</span>
              ) : null}
            </div>
          </div>

          {/* Reuniões */}
          <div className="flex">
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface px-3 py-2 text-xs font-semibold"
              style={{ width: LABEL_W }}
            >
              <span
                className="mr-1.5 inline-block size-2.5 rounded-full bg-aqua align-middle"
                aria-hidden
              />
              Reuniões
              <span className="block pl-4 text-[10px] font-normal text-muted-foreground">
                {sortedMeetings.length}
              </span>
            </div>
            <div className="relative min-h-11 flex-1 py-1">
              {sortedMeetings.map((r, i) => (
                <div
                  key={r.id}
                  className="flex h-6 items-center"
                  title={`${r.title} · ${formatBr(r.date)}${r.time ? ' ' + r.time : ''}`}
                >
                  <span
                    className={`absolute size-2.5 -translate-x-1/2 rounded-full ring-2 ring-surface ${r.date < today ? 'bg-muted-foreground' : 'bg-aqua'}`}
                    style={{ left: m.x(r.date) + DAY_PX / 2 }}
                    aria-hidden
                  />
                  <span
                    className={`absolute whitespace-nowrap text-[10px] ${r.date < today ? 'text-muted-foreground' : 'font-semibold'}`}
                    style={{ left: m.x(r.date) + DAY_PX / 2 + 10, top: i * 24 + 6 }}
                  >
                    {r.time ? `${r.time} ` : ''}
                    {r.title}
                  </span>
                </div>
              ))}
              {sortedMeetings.length === 0 ? (
                <span className="px-2 text-[11px] text-muted-foreground">
                  Nenhuma reunião marcada
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
