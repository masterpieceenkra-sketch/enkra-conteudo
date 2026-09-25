import { useEffect, useState } from 'react'
import { goToBoard } from '../lib/board'
import { addDays, formatShort, todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { pct } from './analytics'
import { mondayOf } from './calendar'
import { GoalRing } from './charts'

interface Row {
  id: string
  name: string
  planned_week: number
  published_week: number
  goal_week: number
  late: number
  with_client: number
  adjust_week: number
  in_progress: number
}

function useOverview(): { rows: Row[]; loading: boolean } {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(() => supabase() !== null)
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    void sb.rpc('comu_hub_content_overview').then(({ data }) => {
      if (cancelled) return
      setRows((data ?? []) as Row[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return { rows, loading }
}

/**
 * Visão geral dos clientes (Meus quadros do app de conteúdo): a semana de cada cliente lado a
 * lado, com a meta publicada e barras comparáveis entre eles. Só quadros em que a pessoa é do time.
 */
export function ClientsOverview() {
  const { rows, loading } = useOverview()
  if (loading) return <div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" aria-hidden />
  if (rows.length === 0) return null
  const mon = mondayOf(todayIso())
  const total = (k: keyof Row) => rows.reduce((a, r) => a + (r[k] as number), 0)
  const max = (k: keyof Row) => Math.max(1, ...rows.map((r) => r[k] as number))
  const goal = total('goal_week')
  const published = total('published_week')
  const summary = [
    { label: 'Publicados', value: published, extra: goal ? `de ${goal} da meta` : 'sem meta' },
    { label: 'Atrasados', value: total('late'), extra: 'em todos os clientes', alert: true },
    { label: 'Com os clientes', value: total('with_client'), extra: 'esperando aprovação' },
    { label: 'Ajustes', value: total('adjust_week'), extra: 'pedidos na semana', alert: true },
  ]

  return (
    <section className="mt-10" aria-label="Visão geral dos clientes">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="label-mono">
            Semana de {formatShort(mon)} a {formatShort(addDays(mon, 6))}
          </p>
          <h2 className="mt-1 text-2xl uppercase sm:text-3xl">Visão geral dos clientes</h2>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="card flex flex-col gap-2 p-4 sm:p-5">
            <span className="label-mono">{s.label}</span>
            <span
              className={`font-display text-4xl font-extrabold tabular-nums leading-none tracking-[-0.04em] ${
                s.alert && s.value > 0 ? 'text-danger' : ''
              }`}
            >
              {s.value}
            </span>
            <span className="text-xs text-muted-foreground">{s.extra}</span>
          </div>
        ))}
      </div>

      <div className="card mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="label-mono px-5 py-3 font-semibold">
                Cliente
              </th>
              <th scope="col" className="label-mono px-3 py-3 font-semibold">
                Meta
              </th>
              <th scope="col" className="label-mono px-3 py-3 font-semibold">
                Posts na semana
              </th>
              <th scope="col" className="label-mono px-3 py-3 font-semibold">
                Atrasados
              </th>
              <th scope="col" className="label-mono px-3 py-3 font-semibold">
                Com o cliente
              </th>
              <th scope="col" className="label-mono px-3 py-3 pr-5 font-semibold">
                Ajustes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => goToBoard(r.id)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2"
              >
                <th scope="row" className="px-5 py-3 text-left">
                  <a
                    href={`/${r.id}`}
                    className="font-display text-base font-bold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.name}
                  </a>
                  <p className="text-xs font-normal text-muted-foreground">
                    {r.in_progress} em andamento
                  </p>
                </th>
                <td className="px-3 py-3">
                  {r.goal_week ? (
                    <span className="flex items-center gap-2">
                      <GoalRing
                        pct={pct(r.published_week, r.goal_week)}
                        size={52}
                        caption={false}
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {r.published_week}/{r.goal_week}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem meta</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Meter
                    value={r.published_week}
                    ghost={r.planned_week}
                    max={max('planned_week')}
                    color="bg-primary"
                    label={`${r.published_week} publicados de ${r.planned_week}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <Meter value={r.late} max={max('late')} color="bg-danger" />
                </td>
                <td className="px-3 py-3">
                  <Meter value={r.with_client} max={max('with_client')} color="bg-blue" />
                </td>
                <td className="px-3 py-3 pr-5">
                  <Meter value={r.adjust_week} max={max('adjust_week')} color="bg-aqua" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Número com uma barra comparável entre os clientes (mesma escala na coluna). */
function Meter({
  value,
  ghost,
  max,
  color,
  label,
}: {
  value: number
  ghost?: number
  max: number
  color: string
  label?: string
}) {
  return (
    <span className="flex min-w-28 items-center gap-2.5" title={label}>
      <span className="w-6 text-right font-display text-lg font-bold tabular-nums">{value}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        {ghost !== undefined ? (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-foreground/15"
            style={{ width: `${(ghost / max) * 100}%` }}
          />
        ) : null}
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${color}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </span>
    </span>
  )
}
