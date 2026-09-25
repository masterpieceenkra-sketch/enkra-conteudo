import { History, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { ACTION_LABELS, detailText, type ActivityRecord } from '../store/activity'
import { useActivity } from '../store/useActivity'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d
    .toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    .replace('.', '')
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  const raw = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Junta ações iguais da mesma pessoa na mesma entidade dentro de 10 min (ex.: digitação). */
function coalesce(items: ActivityRecord[]): (ActivityRecord & { count: number })[] {
  const out: (ActivityRecord & { count: number })[] = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (
      last &&
      last.actor === it.actor &&
      last.action === it.action &&
      last.entityId === it.entityId &&
      Math.abs(new Date(last.at).getTime() - new Date(it.at).getTime()) < 10 * 60_000
    ) {
      last.count += 1
      continue
    }
    out.push({ ...it, count: 1 })
  }
  return out
}

export function HistoryPage() {
  const { items, loading, error, hasMore, loadMore, enabled } = useActivity({ limit: 150 })
  const [actor, setActorFilter] = useState('todos')
  const [q, setQ] = useState('')

  const actors = useMemo(
    () =>
      [...new Set(items.map((i) => i.actor || 'Sem nome'))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [items],
  )
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return coalesce(
      items.filter((i) => {
        if (actor !== 'todos' && (i.actor || 'Sem nome') !== actor) return false
        if (
          needle &&
          !`${i.entityLabel ?? ''} ${ACTION_LABELS[i.action]} ${i.actor}`
            .toLowerCase()
            .includes(needle)
        )
          return false
        return true
      }),
    )
  }, [items, actor, q])

  const groups = useMemo(() => {
    const g: { day: string; items: typeof filtered }[] = []
    for (const it of filtered) {
      const day = dayKey(it.at)
      const last = g[g.length - 1]
      if (last && last.day === day) last.items.push(it)
      else g.push({ day, items: [it] })
    }
    return g
  }, [filtered])

  return (
    <>
      <PageHeader kicker="Registro" title="Histórico">
        Tudo que o time fez neste lançamento, com data, hora e quem fez. Atualiza sozinho enquanto a
        página está aberta.
      </PageHeader>

      {!enabled ? (
        <div className="card p-5 text-sm text-muted-foreground">
          O histórico exige o banco compartilhado, que não está configurado neste ambiente. Neste
          modo os dados ficam só neste navegador.
        </div>
      ) : (
        <>
          <div className="card mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <label className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                className="field pl-9"
                placeholder="Buscar por tarefa, ação ou pessoa"
                aria-label="Buscar no histórico"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="label-mono">Pessoa</span>
              <select
                className="field sm:w-auto"
                value={actor}
                onChange={(e) => setActorFilter(e.target.value)}
              >
                <option value="todos">Todas</option>
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="mb-4 text-sm text-danger">
              Não foi possível carregar o histórico: {error}
            </p>
          ) : null}
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
          {!loading && filtered.length === 0 ? (
            <div className="card flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <History className="size-5" aria-hidden /> Nenhuma ação registrada ainda.
            </div>
          ) : null}

          <div className="grid gap-6">
            {groups.map((g) => (
              <section key={g.day} aria-label={g.day}>
                <h2 className="label-mono mb-2 normal-case">{g.day}</h2>
                <ol className="card divide-y divide-border">
                  {g.items.map((it) => {
                    const detail = detailText(it)
                    const isTask = it.entityType === 'task' && it.entityId
                    return (
                      <li key={it.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                        <span className="w-14 shrink-0 pt-0.5 text-xs text-muted-foreground">
                          {fmtWhen(it.at).split(' ').slice(-1)[0]}
                        </span>
                        <p className="min-w-0 flex-1 leading-snug">
                          <strong>{it.actor || 'Sem nome'}</strong>{' '}
                          {ACTION_LABELS[it.action] ?? it.action}{' '}
                          {it.entityLabel ? (
                            isTask ? (
                              <Link
                                to={`/checklist?card=${it.entityId}`}
                                className="font-semibold text-primary hover:underline"
                              >
                                {it.entityLabel}
                              </Link>
                            ) : (
                              <strong>{it.entityLabel}</strong>
                            )
                          ) : null}
                          {detail ? <span className="text-muted-foreground"> {detail}</span> : null}
                          {it.count > 1 ? (
                            <span className="ml-1.5 rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                              ×{it.count}
                            </span>
                          ) : null}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
          {hasMore ? (
            <button type="button" className="btn-ghost mt-5" onClick={() => void loadMore()}>
              Carregar mais
            </button>
          ) : null}
        </>
      )}
    </>
  )
}
