import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Send,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Donut } from '../../components/charts/Donut'
import { useMe } from '../../components/useActor'
import { addDays, formatShort, todayIso } from '../../lib/dates'
import { useLaunchState } from '../../store/launchStore'
import {
  goalByFormat,
  periodOf,
  periodsUntil,
  pct,
  pipeline,
  shiftPeriod,
  statsFor,
  waitingOnClient,
  type PeriodKind,
} from '../analytics'
import { byDay, weekDays } from '../calendar'
import { CardDrawer } from '../CardDrawer'
import { ColumnChart, GoalRing, ProgressRow } from '../charts'
import { GoalDialog } from '../GoalDialog'
import {
  FORMAT_LABEL,
  columnOf,
  isDueLate,
  isLate,
  isPublished,
  type ContentCard,
  type ContentState,
} from '../model'
import { useIsClient } from '../roles'
import { ApprovalBadge } from '../ui'
import { useCardParam } from '../useCardParam'
import { contentOf } from '../useContent'
import { FORMAT_ICON, SOLID } from '../visual'

const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HISTORY = 8
const SOLID_VAR: Record<string, string> = {
  pink: 'var(--primary)',
  blue: 'var(--blue)',
  aqua: 'var(--aqua)',
  lime: 'var(--lime)',
  black: 'var(--foreground)',
  gray: 'var(--muted-foreground)',
}

/**
 * Analytics do quadro de conteúdo: período (semana ou mês) escolhido no topo, números do
 * período com a variação contra o anterior, meta contra o publicado de verdade, histórico em
 * gráfico e onde o trabalho está parado. No fim, a semana corrente e o que é de cada um.
 */
export function AnalyticsPage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const me = useMe()
  const client = useIsClient()
  const [openId, open, close] = useCardParam()
  const today = todayIso()
  const [kind, setKind] = useState<PeriodKind>('semana')
  const [anchor, setAnchor] = useState(today)
  const [goalOpen, setGoalOpen] = useState(false)

  const period = periodOf(kind, anchor)
  const prev = periodOf(kind, shiftPeriod(kind, anchor, -1))
  const now = statsFor(content, period, today)
  const before = statsFor(content, prev, today)
  const history = periodsUntil(kind, anchor, HISTORY).map((p) => statsFor(content, p, today))
  const formats = goalByFormat(content, period)
  const waiting = waitingOnClient(content, today)
  const pipe = pipeline(content, today)
  const lateNow = content.cards.filter(
    (k) => isLate(content, k, today) || isDueLate(content, k, today),
  )
  const isCurrent = period.from <= today && today <= period.to
  const unit = kind === 'semana' ? 'semana' : 'mês'
  const inUnit = kind === 'semana' ? 'na semana' : 'no mês'
  const goalPct = pct(now.published, now.goal)
  const missing = Math.max(0, now.goal - now.published)
  const first = (me?.name ?? '').trim().split(/\s+/)[0]

  // ------ a semana corrente e as listas (parte de baixo, sempre a semana de hoje) ------
  const days = weekDays(today)
  const map = byDay(content.cards)
  const mine = me
    ? content.cards
        .filter((k) => k.ownerIds.includes(me.id) && !isPublished(content, k))
        .sort((a, b) =>
          (a.due || a.publishAt || '9999').localeCompare(b.due || b.publishAt || '9999'),
        )
    : []
  const soon = content.cards
    .filter(
      (k) =>
        k.due &&
        k.due >= today &&
        k.due <= addDays(today, 7) &&
        !isPublished(content, k) &&
        columnOf(content, k)?.stage !== 'scheduled',
    )
    .sort((a, b) => a.due.localeCompare(b.due))

  const byColumn = waiting.reduce<Record<string, number>>((acc, w) => {
    acc[w.columnName] = (acc[w.columnName] ?? 0) + 1
    return acc
  }, {})
  const waitColors = ['var(--blue)', 'var(--aqua)', 'var(--primary)', 'var(--lime)']
  const avgWait = waiting.length
    ? Math.round(waiting.reduce((a, w) => a + w.days, 0) / waiting.length)
    : 0
  const maxPipe = Math.max(1, ...pipe.map((r) => r.count))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono flex items-center gap-2">
            <span className="brand-squares" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {period.long}
          </p>
          <h1 className="mt-2 text-3xl sm:text-5xl">Analytics</h1>
          {first ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Olá, {first}. O que saiu, o que atrasou e o que está com o cliente.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-border bg-surface p-0.5"
            role="group"
            aria-label="Período"
          >
            {(['semana', 'mes'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                  kind === k ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                }`}
              >
                {k === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              className="icon-btn"
              aria-label={`${unit} anterior`}
              onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={isCurrent}
              className="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider hover:bg-muted disabled:opacity-40"
              onClick={() => setAnchor(today)}
            >
              Atual
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Próximo ${unit}`}
              onClick={() => setAnchor(shiftPeriod(kind, anchor, 1))}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          {!client ? (
            <button
              type="button"
              className="btn-ghost h-9 py-0 text-sm"
              onClick={() => setGoalOpen(true)}
            >
              <Target className="size-4" aria-hidden /> Meta
            </button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<Send className="size-4" aria-hidden />}
          label={`Publicados ${inUnit}`}
          value={now.published}
          hint={`${now.planned} ${now.planned === 1 ? 'planejado' : 'planejados'}`}
          delta={now.published - before.published}
          good="up"
        />
        <Kpi
          icon={<AlertTriangle className="size-4" aria-hidden />}
          label="Atrasados"
          value={now.late}
          hint={`${lateNow.length} atrasados no quadro hoje`}
          delta={now.late - before.late}
          good="down"
          alert={now.late > 0}
          to="/quadro"
        />
        <Kpi
          icon={<BadgeCheck className="size-4" aria-hidden />}
          label="Com o cliente"
          value={waiting.length}
          hint={
            !waiting.length
              ? 'nada esperando'
              : avgWait
                ? `espera média de ${avgWait} ${avgWait === 1 ? 'dia' : 'dias'}`
                : 'esperando aprovação'
          }
          to="/aprovar"
        />
        <Kpi
          icon={<PenLine className="size-4" aria-hidden />}
          label={`Ajustes ${inUnit}`}
          value={now.adjusts}
          hint="pedidos pelo cliente"
          delta={now.adjusts - before.adjusts}
          good="down"
          alert={now.adjusts > 0}
          to="/aprovar"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel
          title="Meta de publicação"
          sub={
            now.goal
              ? `${now.published} de ${now.goal} publicados${missing ? ` · faltam ${missing}` : ' · meta batida'}`
              : 'Sem meta definida'
          }
        >
          {now.goal ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <GoalRing pct={goalPct} />
              <ul className="flex w-full min-w-0 flex-1 flex-col gap-3.5">
                {formats.map((f) => (
                  <ProgressRow
                    key={f.format}
                    label={FORMAT_LABEL[f.format]}
                    value={f.published}
                    ghost={f.planned}
                    goal={f.goal}
                  />
                ))}
                <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-3 rounded-full bg-primary" aria-hidden /> Publicado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-3 rounded-full bg-foreground/15" aria-hidden />{' '}
                    Planejado
                  </span>
                </li>
              </ul>
            </div>
          ) : (
            <EmptyGoal client={client} onOpen={() => setGoalOpen(true)} />
          )}
        </Panel>

        <Panel
          title={`Posts por ${unit}`}
          sub={`Últimos ${HISTORY} ${kind === 'semana' ? 'semanas' : 'meses'}: publicado, o que falta sair e a meta`}
        >
          <ColumnChart
            title={`Posts por ${unit}`}
            color="var(--primary)"
            valueLabel="Publicado"
            extraLabel="Planejado, ainda não publicado"
            points={history.map((h) => ({
              key: h.period.from,
              label: h.period.short,
              value: h.published,
              extra: Math.max(0, h.planned - h.published),
              goal: h.goal || undefined,
              active: h.period.from === period.from,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={`Atrasos por ${unit}`} sub="Posts com data no período que passaram sem sair">
          <ColumnChart
            title={`Atrasos por ${unit}`}
            color="var(--danger)"
            valueLabel="Atrasados"
            height={140}
            points={history.map((h) => ({
              key: h.period.from,
              label: h.period.short,
              value: h.late,
              active: h.period.from === period.from,
            }))}
          />
        </Panel>
        <Panel
          title={`Ajustes pedidos por ${unit}`}
          sub="Quantas vezes o cliente devolveu um conteúdo"
        >
          <ColumnChart
            title={`Ajustes por ${unit}`}
            color="var(--blue)"
            valueLabel="Ajustes pedidos"
            height={140}
            points={history.map((h) => ({
              key: h.period.from,
              label: h.period.short,
              value: h.adjusts,
              active: h.period.from === period.from,
            }))}
          />
        </Panel>
        <Panel title="Com o cliente agora" sub="Esperando aprovação, por coluna">
          {waiting.length ? (
            <div className="flex flex-col gap-4">
              <Donut
                title="Com o cliente"
                centerValue={String(waiting.length)}
                centerLabel="cards"
                size={128}
                segments={Object.entries(byColumn).map(([name, value], i) => ({
                  key: name,
                  label: name,
                  value,
                  color: waitColors[i % waitColors.length],
                }))}
              />
              <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
                {waiting.slice(0, 3).map((w) => (
                  <li key={w.card.id}>
                    <button
                      type="button"
                      onClick={() => open(w.card.id)}
                      className="flex w-full items-center gap-2 text-left text-xs hover:text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {w.card.title || 'Sem título'}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${w.days >= 3 ? 'font-bold text-danger' : 'text-muted-foreground'}`}
                      >
                        {w.days ? `há ${w.days}d` : 'hoje'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nada esperando o cliente.
            </p>
          )}
        </Panel>
      </div>

      <Panel
        title="Onde está o trabalho"
        sub="Cards em cada coluna agora; a parte vermelha está atrasada"
      >
        <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {pipe.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`size-2.5 rounded-full ${SOLID[r.color]}`} aria-hidden />
                  {r.name}
                </span>
                <span className="tabular-nums">
                  <span className="font-bold">{r.count}</span>
                  {r.late ? (
                    <span className="text-danger">
                      {' '}
                      · {r.late} atrasado{r.late > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${((r.count - r.late) / maxPipe) * 100}%`,
                    background: SOLID_VAR[r.color],
                  }}
                />
                <span
                  className="h-full bg-danger transition-[width] duration-500"
                  style={{ width: `${(r.late / maxPipe) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <section aria-label="Publicações da semana" className="mt-2">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl uppercase">Esta semana</h2>
          <Link
            to="/calendario"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Calendário <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="grid gap-2 sm:grid-cols-7">
          {days.map((d, i) => {
            const list = map.get(d) ?? []
            const isToday = d === today
            return (
              <li
                key={d}
                className={`flex min-h-32 flex-col gap-1.5 rounded-xl border p-2 ${
                  isToday ? 'border-primary bg-pink-soft/30' : 'border-border bg-surface'
                }`}
              >
                <p className="flex items-baseline justify-between px-0.5">
                  <span className="label-mono">{DOW[i]}</span>
                  <span
                    className={`text-sm font-bold tabular-nums ${isToday ? 'text-primary' : ''}`}
                  >
                    {Number(d.slice(8))}
                  </span>
                </p>
                {list.map((k) => (
                  <MiniCard
                    key={k.id}
                    card={k}
                    content={content}
                    today={today}
                    onOpen={() => open(k.id)}
                  />
                ))}
                {list.length === 0 ? (
                  <p className="px-0.5 text-[11px] text-muted-foreground/70">livre</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {!client ? (
          <ListSection title="Com você" empty="Nenhum card seu em aberto.">
            {mine.slice(0, 8).map((k) => (
              <Row key={k.id} card={k} content={content} today={today} onOpen={() => open(k.id)} />
            ))}
          </ListSection>
        ) : null}
        <ListSection title="Prazos de produção (7 dias)" empty="Nenhum prazo nos próximos 7 dias.">
          {soon.slice(0, 8).map((k) => (
            <Row
              key={k.id}
              card={k}
              content={content}
              today={today}
              onOpen={() => open(k.id)}
              due
            />
          ))}
        </ListSection>
      </div>

      <GoalDialog open={goalOpen} onClose={() => setGoalOpen(false)} />
      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card flex min-w-0 flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold tracking-[-0.02em]">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyGoal({ client, onOpen }: { client: boolean; onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-pink-soft text-primary">
        <Target className="size-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">
        {client
          ? 'O time ainda não definiu a meta de publicações.'
          : 'Defina quantos posts de cada formato saem por semana. O Analytics compara com o que foi publicado de verdade.'}
      </p>
      {!client ? (
        <button type="button" className="btn-primary" onClick={onOpen}>
          Definir meta
        </button>
      ) : null}
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
  delta,
  good,
  alert,
  to,
}: {
  icon: ReactNode
  label: string
  value: number
  hint: string
  /** diferença contra o período anterior */
  delta?: number
  /** para que lado a variação é boa */
  good?: 'up' | 'down'
  alert?: boolean
  to?: string
}) {
  const better = delta !== undefined && delta !== 0 && delta > 0 === (good === 'up')
  const body = (
    <>
      <span className="label-mono flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className="flex items-end gap-2">
        <span
          className={`font-display text-4xl font-extrabold tabular-nums leading-none tracking-[-0.04em] sm:text-5xl ${alert ? 'text-danger' : ''}`}
        >
          {value}
        </span>
        {delta !== undefined && delta !== 0 ? (
          <span
            className={`mb-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              better ? 'bg-lime-soft text-foreground' : 'bg-pink-soft text-foreground'
            }`}
            title="Contra o período anterior"
          >
            {delta > 0 ? (
              <TrendingUp className="size-3" aria-hidden />
            ) : (
              <TrendingDown className="size-3" aria-hidden />
            )}
            {delta > 0 ? `+${delta}` : delta}
          </span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </>
  )
  const cls =
    'card flex flex-col gap-3 p-4 transition-colors sm:p-5 ' +
    (to ? 'hover:border-muted-foreground/40' : '')
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function MiniCard({
  card,
  content,
  today,
  onOpen,
}: {
  card: ContentCard
  content: ContentState
  today: string
  onOpen: () => void
}) {
  const Icon = FORMAT_ICON[card.format]
  const col = columnOf(content, card)
  const late = isLate(content, card, today)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-muted-foreground/40"
    >
      <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <span
          className={`size-1.5 shrink-0 rounded-full ${SOLID[col?.color ?? 'gray']}`}
          aria-hidden
        />
        <Icon className="size-3" aria-hidden />
        {card.publishTime || col?.name}
      </span>
      <span
        className={`line-clamp-2 text-xs font-semibold leading-snug ${late ? 'text-danger' : ''}`}
      >
        {card.title || 'Sem título'}
      </span>
    </button>
  )
}

function ListSection({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: ReactNode[]
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl uppercase">{title}</h2>
      {children.length ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        <p className="card px-4 py-5 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function Row({
  card,
  content,
  today,
  onOpen,
  due,
}: {
  card: ContentCard
  content: ContentState
  today: string
  onOpen: () => void
  due?: boolean
}) {
  const Icon = FORMAT_ICON[card.format]
  const col = columnOf(content, card)
  const date = due ? card.due : card.publishAt || card.due
  const late = isLate(content, card, today) || isDueLate(content, card, today)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="card flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:border-muted-foreground/40"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{card.title || 'Sem título'}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-1.5 rounded-full ${SOLID[col?.color ?? 'gray']}`} aria-hidden />
            {col?.name}
          </span>
        </span>
        {card.approval ? <ApprovalBadge state={card.approval.state} /> : null}
        {date ? (
          <span
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${late ? 'bg-danger text-danger-foreground' : 'bg-muted'}`}
          >
            {due ? 'prazo ' : ''}
            {formatShort(date)}
          </span>
        ) : null}
      </button>
    </li>
  )
}
