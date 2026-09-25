import { AlertTriangle, ArrowRight, Flag } from 'lucide-react'
import { Link } from 'react-router'
import { LabelChip } from '../components/LabelChip'
import { MeetingsPanel } from '../components/MeetingsPanel'
import { Timeline } from '../components/Timeline'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { formatBr, formatShort, relativeLabel, todayIso } from '../lib/dates'
import {
  allTasks,
  currentPhase,
  nextMilestone,
  overdueTasks,
  progressOf,
  useLaunchActions,
  useLaunchState,
} from '../store/launchStore'

export function DashboardPage() {
  const s = useLaunchState()
  const { patchTask } = useLaunchActions()
  const today = todayIso()

  const total = progressOf(allTasks(s))
  const phase = currentPhase(s, today)
  const milestone = nextMilestone(s, today)
  const overdue = overdueTasks(s, today)

  const nextTasks = (() => {
    if (!phase) return []
    return phase.areas
      .flatMap((a) => a.tasks.filter((t) => !t.done).map((t) => ({ ...t, area: a.name })))
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 8)
  })()

  const upcoming = [...s.milestones]
    .filter((m) => m.date && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  const launchStarted = s.launchStart <= today

  return (
    <>
      <PageHeader kicker="Comu HUB" title="GPS do Lançamento">
        Seu lançamento inteiro em quatro telas. Comece pelo brief, ajuste as datas no calendário e
        vá marcando o checklist. Tudo é salvo automaticamente neste navegador.
      </PageHeader>

      {/* Cards de resumo */}
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="card bg-secondary p-4 text-secondary-foreground sm:p-6">
          <p className="label-mono text-secondary-foreground/60">Progresso geral</p>
          <p className="mt-1 font-display text-4xl sm:mt-2 sm:text-5xl">{total.pct}%</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary-foreground/15 sm:mt-4">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${total.pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm opacity-70 sm:mt-3">
            {total.done} de {total.total} tarefas concluídas
          </p>
        </div>

        <div className="card p-4 sm:p-6">
          <p className="label-mono">{launchStarted ? 'Fase atual' : 'Primeira fase'}</p>
          <p className="mt-1 font-display text-xl sm:mt-2 sm:text-2xl">{phase?.name ?? '—'}</p>
          <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
            {formatBr(phase?.start)} → {formatBr(phase?.end)}
          </p>
          <p className="mt-3 text-sm sm:mt-4">
            {launchStarted ? 'Lançamento começou em' : 'Lançamento começa em'}{' '}
            <strong>{formatBr(s.launchStart)}</strong>
            {!launchStarted ? (
              <span className="text-muted-foreground">
                {' '}
                · {relativeLabel(s.launchStart, today)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="card p-4 sm:p-6">
          <p className="label-mono">Próximo marco</p>
          <p className="mt-1 font-display text-xl sm:mt-2 sm:text-2xl">
            {milestone?.label ?? 'Lançamento concluído'}
          </p>
          {milestone ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">{formatBr(milestone.date)}</p>
              <p className="mt-4 inline-block rounded-md bg-lime px-3 py-1 text-sm font-semibold text-lime-foreground">
                {relativeLabel(milestone.date, today)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum marco futuro no calendário.</p>
          )}
        </div>
      </div>

      <div className="mt-5 sm:mt-6">
        <Timeline state={s} today={today} />
      </div>

      {/* Foco de agora */}
      <div className="mt-5 grid gap-4 sm:mt-6 lg:grid-cols-[3fr_2fr]">
        <section className="card p-4 sm:p-6" aria-labelledby="next-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="next-title" className="text-xl">
              Próximas tarefas
            </h2>
            <span className="text-sm text-muted-foreground">{phase?.name}</span>
          </div>
          {nextTasks.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Tudo da fase atual está concluído. Bora para a próxima.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {nextTasks.map((t) => {
                const late = t.due && t.due < today
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      className="checkbox mt-0.5"
                      checked={t.done}
                      aria-label={`Concluir: ${t.label}`}
                      onChange={(e) => patchTask(t.id, { done: e.target.checked })}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{t.label}</p>
                      {t.labelIds?.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.labels
                            .filter((l) => t.labelIds?.includes(l.id))
                            .map((l) => (
                              <LabelChip key={l.id} label={l} />
                            ))}
                        </span>
                      ) : null}
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span className="font-semibold">{t.area}</span>
                        {t.owner ? <span>· {t.owner}</span> : null}
                        {t.due ? (
                          <span className={late ? 'font-semibold text-danger' : ''}>
                            · {late ? 'atrasada' : 'até'} {formatShort(t.due)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            to="/checklist?filtro=todas"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Abrir checklist completo <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        <div className="grid gap-4">
          <MeetingsPanel today={today} />
          {overdue.length > 0 ? (
            <section className="card border-danger/40 p-4 sm:p-6" aria-labelledby="late-title">
              <h2 id="late-title" className="flex items-center gap-2 text-xl text-danger">
                <AlertTriangle className="size-5" aria-hidden /> {overdue.length} atrasada
                {overdue.length > 1 ? 's' : ''}
              </h2>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {overdue.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatShort(t.due)}
                    </span>
                  </li>
                ))}
              </ul>
              {overdue.length > 5 ? (
                <Link
                  to="/checklist?filtro=atrasadas"
                  className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  Ver todas
                </Link>
              ) : null}
            </section>
          ) : null}

          <section className="card p-4 sm:p-6" aria-labelledby="ms-title">
            <h2 id="ms-title" className="flex items-center gap-2 text-xl">
              <Flag className="size-5" aria-hidden /> Marcos à frente
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum marco futuro.</p>
            ) : (
              <ol className="mt-3 grid gap-2">
                {upcoming.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{m.label}</span>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                      {relativeLabel(m.date, today)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* Progresso por fase */}
      <h2 className="mt-9 text-xl sm:mt-12 sm:text-2xl">Progresso por fase</h2>
      <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3">
        {s.phases.map((p) => {
          const pr = progressOf(p.areas.flatMap((a) => a.tasks))
          const active = p.id === phase?.id && launchStarted
          return (
            <Link
              key={p.id}
              to={`/checklist?fase=${p.id}`}
              className={`card block p-4 transition-colors hover:border-primary sm:flex sm:flex-wrap sm:items-center sm:gap-4 ${
                active ? 'border-primary/60' : ''
              }`}
            >
              <span className="flex items-center gap-2 font-semibold sm:min-w-56 sm:flex-1">
                {p.name}
                {active ? (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    agora
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground sm:mt-0">
                {formatBr(p.start)} → {formatBr(p.end)}
              </span>
              <div className="mt-3 flex items-center gap-3 sm:mt-0 sm:gap-4">
                <ProgressBar
                  value={pr.pct}
                  className="flex-1 sm:w-40 sm:flex-none"
                  label={`${p.name}: ${pr.pct}%`}
                />
                <span className="w-16 shrink-0 text-right text-sm font-semibold">
                  {pr.done}/{pr.total}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-9 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
        <Link to="/brief" className="card p-4 transition-colors hover:border-primary sm:p-6">
          <p className="label-mono">Passo 1</p>
          <h3 className="mt-2 text-xl">Preencher o brief</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Metas, persona, oferta e time. É o mapa que todo mundo consulta.
          </p>
        </Link>
        <Link to="/calendario" className="card p-4 transition-colors hover:border-primary sm:p-6">
          <p className="label-mono">Passo 2</p>
          <h3 className="mt-2 text-xl">Ajustar o calendário</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Mude a data de início e todas as fases e marcos acompanham.
          </p>
        </Link>
        <Link to="/diario" className="card p-4 transition-colors hover:border-primary sm:p-6">
          <p className="label-mono">Todo dia</p>
          <h3 className="mt-2 text-xl">Registrar o diário</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Anote o que aconteceu em cada área para facilitar o debriefing.
          </p>
        </Link>
      </div>
    </>
  )
}
