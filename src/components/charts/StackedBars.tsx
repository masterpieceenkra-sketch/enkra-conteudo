import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { STATUS_LABELS } from '../../store/analytics'
import { STATUS_COLORS } from './colors'

export interface BarRow {
  key: string
  label: string
  /** cargo, ou "Sem responsável" */
  sublabel?: string
  done: number
  pending: number
  late: number
  total: number
  pct: number
  /** fatia do total geral (0–100) */
  share?: number
  /** rota do checklist */
  to?: string
  /** cor do quadradinho antes do rótulo (fases) */
  accent?: string
}

interface Props {
  rows: BarRow[]
  title: string
  emptyMessage: string
  /** 'full': toda barra ocupa a largura; 'max': largura proporcional ao maior total (carga) */
  scale?: 'full' | 'max'
  showShare?: boolean
}

export function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(['done', 'pending', 'late'] as const).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: STATUS_COLORS[k] }}
            aria-hidden
          />
          {STATUS_LABELS[k]}
        </li>
      ))}
    </ul>
  )
}

/** Barras horizontais empilhadas (concluídas · pendentes · atrasadas), uma linha por grupo. */
export function StackedBars({
  rows,
  title,
  emptyMessage,
  scale = 'full',
  showShare = false,
}: Props) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  return (
    <ul className="grid gap-4" aria-label={title}>
      {rows.map((r) => {
        const seg = (v: number) => (r.total ? `${(v / r.total) * 100}%` : '0%')
        const desc = `${r.label}: ${r.done} concluídas, ${r.pending} pendentes, ${r.late} atrasadas`
        const name = (
          <span className="flex min-w-0 items-center gap-2">
            {r.accent ? (
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: r.accent }}
                aria-hidden
              />
            ) : null}
            <span className="truncate font-semibold" title={r.label}>
              {r.label}
            </span>
            {r.sublabel ? (
              <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 font-display text-[0.625rem] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                {r.sublabel}
              </span>
            ) : null}
            {r.to ? (
              <ArrowRight
                className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            ) : null}
          </span>
        )
        return (
          <li key={r.key} className="group grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {r.to ? (
                <Link to={r.to} className="min-w-0 hover:text-primary">
                  {name}
                </Link>
              ) : (
                name
              )}
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {showShare && r.share !== undefined ? (
                  <span className="label-mono mr-3">{Math.round(r.share)}% do total</span>
                ) : null}
                {r.total ? (
                  <>
                    {r.done}/{r.total} · <strong className="text-foreground">{r.pct}%</strong>
                  </>
                ) : (
                  '0/0 · —'
                )}
              </span>
            </div>
            <div
              role="img"
              aria-label={desc}
              className="flex h-3 overflow-hidden rounded-full bg-muted"
              style={{ width: scale === 'max' ? `${(r.total / max) * 100}%` : '100%' }}
            >
              <span
                style={{ width: seg(r.done), background: STATUS_COLORS.done }}
                title={`${r.done} concluídas`}
              />
              <span
                style={{ width: seg(r.pending), background: STATUS_COLORS.pending }}
                title={`${r.pending} pendentes`}
              />
              <span
                style={{ width: seg(r.late), background: STATUS_COLORS.late }}
                title={`${r.late} atrasadas`}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
