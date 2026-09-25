import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { phaseColor } from '../data/phaseColors'
import { phaseHasDates, type LaunchState, type Milestone } from '../data/types'

type TlMilestone = Milestone & { pct: number; past: boolean }
import { diffDays, formatBr, formatShort, isValidIso } from '../lib/dates'
import { GanttChart } from './GanttChart'
import { MonthCalendar } from './MonthCalendar'

interface Props {
  state: LaunchState
  today: string
  /** começa expandida no calendário mensal */
  defaultExpanded?: boolean
  /** esconde o link "Editar datas" (na própria página de calendário) */
  hideEditLink?: boolean
  /** torna as barras do Gantt arrastáveis */
  onPhaseChange?: (phaseId: string, patch: { start: string; end: string }) => void
}

/** Nome curto da fase para caber na barra: "Fase 3: Captação" → "Captação". */
function shortName(name: string): string {
  return name.replace(/^Fase\s*\d+\s*:\s*/i, '').trim() || name
}

export function Timeline({
  state,
  today,
  defaultExpanded = false,
  hideEditLink = false,
  onPhaseChange,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [view, setView] = useState<'gantt' | 'mes'>('gantt')

  const model = useMemo(() => {
    const phases = state.phases.filter(
      (p) => isValidIso(p.start) && isValidIso(p.end) && p.end >= p.start,
    )
    const dates = [
      ...phases.flatMap((p) => [p.start, p.end]),
      ...state.milestones.map((m) => m.date),
      ...state.meetings.map((m) => m.date),
      today,
    ].filter(isValidIso)
    if (!dates.length) return null
    const min = dates.reduce((a, b) => (a < b ? a : b))
    const max = dates.reduce((a, b) => (a > b ? a : b))
    const span = Math.max(1, diffDays(min, max) + 1)
    const pct = (iso: string) => ((diffDays(min, iso) + 0.5) / span) * 100
    const currentIdx = state.phases.findIndex((p) => p.start <= today && today <= p.end)
    const segments = phases.map((p) => {
      const idx = state.phases.indexOf(p)
      return {
        phase: p,
        idx,
        left: (diffDays(min, p.start) / span) * 100,
        width: ((diffDays(p.start, p.end) + 1) / span) * 100,
        color: phaseColor(idx),
        current: idx === currentIdx,
      }
    })
    const sorted = [...state.milestones]
      .filter((m) => isValidIso(m.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m): TlMilestone => ({ ...m, pct: pct(m.date), past: m.date < today }))
    // Marcos a menos de ~5% da barra viram um bloco só, para os rótulos não se sobreporem.
    const clusters: { pct: number; items: TlMilestone[]; row: number }[] = []
    for (const m of sorted) {
      const last = clusters[clusters.length - 1]
      if (last && m.pct - last.items[0].pct < 5) last.items.push(m)
      else clusters.push({ pct: m.pct, items: [m], row: clusters.length % 2 })
    }
    for (const c of clusters) c.pct = c.items.reduce((a, m) => a + m.pct, 0) / c.items.length
    const inRange = today >= min && today <= max
    return {
      min,
      max,
      span,
      pct,
      segments,
      milestones: sorted,
      clusters,
      todayPct: inRange ? pct(today) : null,
      currentIdx,
    }
  }, [state, today])

  const undated = state.phases.filter((p) => !phaseHasDates(p)).length
  if (!model) return null
  const current = model.currentIdx >= 0 ? state.phases[model.currentIdx] : null
  const next = state.phases.find((p) => p.start > today)

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="tl-title">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="tl-title" className="text-xl">
          Linha do tempo
        </h2>
        <p className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-lime px-2 py-0.5 font-semibold text-lime-foreground">
            <span className="size-1.5 rounded-full bg-lime-foreground" aria-hidden />
            Hoje · {formatShort(today)}
          </span>
          {current ? (
            <span className="text-muted-foreground">
              você está em <strong className="text-foreground">{current.name}</strong>
              {' · '}
              {diffDays(today, current.end) === 0
                ? 'último dia da fase'
                : `${diffDays(today, current.end)} ${diffDays(today, current.end) === 1 ? 'dia' : 'dias'} até o fim da fase`}
            </span>
          ) : next ? (
            <span className="text-muted-foreground">
              antes do início · <strong className="text-foreground">{next.name}</strong> começa em{' '}
              {formatShort(next.start)}
            </span>
          ) : (
            <span className="text-muted-foreground">nenhuma fase em andamento</span>
          )}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {undated ? (
            <span className="text-xs text-muted-foreground">
              {undated} {undated === 1 ? 'fase sem data' : 'fases sem data'}, fora da barra
            </span>
          ) : null}
          {!hideEditLink ? (
            <Link to="/calendario" className="text-sm font-semibold text-primary hover:underline">
              Editar datas
            </Link>
          ) : null}
          <button
            type="button"
            className="btn-ghost h-8 px-2.5 py-0 text-xs"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            <CalendarDays className="size-3.5" aria-hidden />
            {expanded ? 'Recolher calendário' : 'Ver calendário'}
            {expanded ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Barra de fases */}
      <div className="relative mt-6 pt-7">
        {model.todayPct !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 h-full"
            style={{ left: `${model.todayPct}%` }}
            aria-hidden
          >
            <span
              className={`absolute top-0 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[11px] font-bold text-background ${
                model.todayPct > 80
                  ? 'right-0'
                  : model.todayPct < 20
                    ? 'left-0'
                    : '-translate-x-1/2'
              }`}
            >
              você está aqui
            </span>
            <span className="absolute left-0 top-6 h-[calc(100%-1.5rem)] w-0.5 -translate-x-1/2 bg-foreground" />
          </div>
        ) : null}
        <div className="relative h-10 overflow-hidden rounded-lg bg-muted">
          {model.segments.map((s) => (
            <Link
              key={s.phase.id}
              to={`/checklist?fase=${s.phase.id}`}
              title={`${s.phase.name}: ${formatBr(s.phase.start)} → ${formatBr(s.phase.end)}`}
              className={`absolute top-0 flex h-full items-center overflow-hidden border-r border-background px-2 text-[11px] font-bold uppercase tracking-wider transition-[filter] hover:brightness-110 last:border-0 ${
                s.current ? 'ring-2 ring-inset ring-foreground' : ''
              }`}
              style={{
                left: `${s.left}%`,
                width: `${s.width}%`,
                background: s.color.bg,
                color: s.color.fg,
              }}
            >
              <span className={`truncate ${s.width < 7 ? 'sr-only' : ''}`}>
                {shortName(s.phase.name)}
              </span>
            </Link>
          ))}
        </div>

        {/* Marcos */}
        <div className="relative mt-1 h-32">
          {model.milestones.map((m) => (
            <span
              key={m.id}
              className={`absolute top-0 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] ring-2 ring-surface ${m.past ? 'bg-muted-foreground' : 'bg-lime'}`}
              style={{ left: `${m.pct}%` }}
              title={`${m.label} · ${formatBr(m.date)}`}
              aria-hidden
            />
          ))}
          {model.clusters.map((c, i) => (
            <div
              key={i}
              className={`absolute w-max max-w-44 text-[10px] leading-tight ${
                c.pct > 88 ? 'text-right' : c.pct < 12 ? 'text-left' : 'text-center'
              }`}
              style={{
                left: `${c.pct}%`,
                top: `${0.9 + c.row * 3.6}rem`,
                transform:
                  c.pct > 88 ? 'translateX(-100%)' : c.pct < 12 ? 'none' : 'translateX(-50%)',
              }}
            >
              {c.row === 1 ? (
                <span
                  className="absolute -top-[2.5rem] left-1/2 h-[2.4rem] w-px bg-border"
                  aria-hidden
                />
              ) : null}
              {c.items.map((m) => (
                <p
                  key={m.id}
                  className={`whitespace-normal ${m.past ? 'text-muted-foreground' : ''}`}
                >
                  <span className={m.past ? '' : 'font-semibold'}>{m.label}</span>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {' '}
                    · {formatBr(m.date).slice(0, 5)}
                  </span>
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {expanded ? (
        <div className="fade-in mt-6 border-t border-border pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="group" aria-label="Visualização" className="flex gap-1.5">
              <button
                type="button"
                className={`chip ${view === 'gantt' ? 'chip-active' : ''}`}
                aria-pressed={view === 'gantt'}
                onClick={() => setView('gantt')}
              >
                Gantt
              </button>
              <button
                type="button"
                className={`chip ${view === 'mes' ? 'chip-active' : ''}`}
                aria-pressed={view === 'mes'}
                onClick={() => setView('mes')}
              >
                Mês a mês
              </button>
            </div>
            {onPhaseChange && view === 'gantt' ? (
              <p className="text-xs text-muted-foreground">
                Arraste uma fase para mover as datas; puxe as bordas para mudar só o início ou o
                fim.
              </p>
            ) : null}
          </div>
          {view === 'gantt' ? (
            <GanttChart
              phases={state.phases}
              milestones={state.milestones}
              meetings={state.meetings}
              today={today}
              from={model.min}
              to={model.max}
              onPhaseChange={onPhaseChange}
            />
          ) : (
            <MonthCalendar
              phases={state.phases}
              milestones={state.milestones}
              meetings={state.meetings}
              today={today}
              from={model.min}
              to={model.max}
            />
          )}
        </div>
      ) : null}
    </section>
  )
}
