import { Link } from 'react-router'
import { formatShort } from '../lib/dates'
import { weekCadence } from './cadence'
import { mondayOf } from './calendar'
import { FORMAT_LABEL, type ContentState } from './model'
import { useIsClient } from './roles'

/** Meta de cadência de cada semana visível no calendário: quanto está planejado contra a meta. */
export function CadenceStrip({ content, days }: { content: ContentState; days: string[] }) {
  const client = useIsClient()
  const mondays = [...new Set(days.map(mondayOf))]
  const hasGoals = content.strategy.cadence.some((g) => g.perWeek > 0)
  if (!hasGoals)
    return client ? null : (
      <p className="mt-3 text-xs text-muted-foreground">
        Defina a cadência (ex.: 14 reels por semana) na{' '}
        <Link
          to="/estrategia#cadencia"
          className="font-semibold text-foreground underline underline-offset-2"
        >
          Estratégia
        </Link>{' '}
        e o calendário mostra aqui quanto falta em cada semana.
      </p>
    )
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Cadência por semana">
      {mondays.map((m) => {
        const rows = weekCadence(content, m)
        return (
          <li key={m} className="rounded-xl border border-border bg-surface px-3 py-2.5">
            <p className="label-mono">Semana de {formatShort(m)}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {rows.map((r) => {
                const ok = r.planned >= r.goal
                return (
                  <span key={r.format} className="text-xs">
                    <span className="text-muted-foreground">{FORMAT_LABEL[r.format]}</span>{' '}
                    <span className={`font-bold tabular-nums ${ok ? '' : 'text-danger'}`}>
                      {r.planned}/{r.goal}
                    </span>
                  </span>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
