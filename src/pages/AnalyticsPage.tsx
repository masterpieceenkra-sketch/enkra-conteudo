import { MessageCircle, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Donut } from '../components/charts/Donut'
import { StackedBars, StatusLegend } from '../components/charts/StackedBars'
import { StatCard } from '../components/charts/StatCard'
import { STATUS_COLORS } from '../components/charts/colors'
import { PageHeader } from '../components/PageHeader'
import { phaseColor } from '../data/phaseColors'
import { addDays, formatShort, todayIso } from '../lib/dates'
import {
  byOwner,
  byPhase,
  distribution,
  DUE_SOON_DAYS,
  NOTIFICATION_KIND_LABELS,
  notificationStats,
  overallStats,
  type NotificationKind,
} from '../store/analytics'
import { SYNC_ENABLED } from '../lib/supabase'
import { useNotifications } from '../store/useNotifications'
import type { Person } from '../data/types'
import { useLaunchState } from '../store/launchStore'

const OWNER_COLORS = ['#3a39ff', '#00c8c7', '#f10064', '#cfe600', '#8584ff', '#ff6fa3', '#6fe3e0']
const MAX_OWNER_SLICES = 7

export function AnalyticsPage() {
  const s = useLaunchState()
  const today = todayIso()
  const overall = useMemo(() => overallStats(s, today), [s, today])
  const owners = useMemo(() => byOwner(s, today), [s, today])
  const phases = useMemo(() => byPhase(s, today), [s, today])

  const named = owners.filter((o) => !o.unassigned)
  const unassigned = owners.find((o) => o.unassigned)
  const donePct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0
  const loadSlices = (() => {
    const top = named.slice(0, MAX_OWNER_SLICES)
    const rest = named.slice(MAX_OWNER_SLICES).reduce((a, o) => a + o.total, 0)
    const out = top.map((o, i) => ({
      key: o.key,
      label: o.name,
      value: o.total,
      color: OWNER_COLORS[i % OWNER_COLORS.length],
    }))
    if (rest > 0)
      out.push({ key: 'outros', label: 'Outros', value: rest, color: 'var(--muted-foreground)' })
    return out
  })()

  return (
    <>
      <PageHeader kicker="Leitura do lançamento" title="Analytics">
        Quem está com o quê, o que está atrasado e como cada fase avança. Clique em qualquer número
        ou nome para abrir a lista correspondente no checklist.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        <StatCard
          tone="hero"
          label="Tarefas"
          value={overall.total}
          hint={`${overall.pct}% concluído`}
          to="/checklist?filtro=todas"
        />
        <StatCard
          label="Concluídas"
          value={overall.done}
          hint={`${donePct}% do total`}
          to="/checklist?filtro=concluidas"
        />
        <StatCard
          label="Pendentes"
          value={overall.pending}
          hint={overall.noDue ? `no prazo · ${overall.noDue} sem data` : 'no prazo'}
          to="/checklist?filtro=pendentes"
        />
        <StatCard
          label="A vencer"
          value={overall.soon}
          hint={
            overall.soon
              ? `vencem até ${formatShort(addDays(today, DUE_SOON_DAYS))}`
              : 'nada vencendo nos próximos dias'
          }
          to="/checklist?filtro=avencer"
        />
        <StatCard
          tone="danger"
          label="Atrasadas"
          value={overall.late}
          hint={overall.late ? 'precisam de atenção' : 'nada atrasado'}
          to="/checklist?filtro=atrasadas"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="card p-4 sm:p-6" aria-labelledby="an-dist">
          <p className="label-mono">Distribuição geral</p>
          <h2 id="an-dist" className="mt-1 text-xl">
            Estado das tarefas
          </h2>
          <Donut
            className="mt-5"
            title="Distribuição geral das tarefas"
            segments={distribution(overall).map((d) => ({
              key: d.key,
              label: d.label,
              value: d.value,
              color: STATUS_COLORS[d.key],
            }))}
            centerValue={`${overall.pct}%`}
            centerLabel="concluído"
          />
        </section>

        <section className="card p-4 sm:p-6" aria-labelledby="an-phase">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="label-mono">Por fase</p>
              <h2 id="an-phase" className="mt-1 text-xl">
                Progresso de cada fase
              </h2>
            </div>
            <StatusLegend />
          </div>
          <div className="mt-5">
            <StackedBars
              title="Progresso por fase"
              emptyMessage="Nenhuma fase cadastrada."
              rows={phases.map((p) => ({
                key: p.phaseId,
                label: p.name,
                done: p.done,
                pending: p.pending,
                late: p.late,
                total: p.total,
                pct: p.pct,
                accent: phaseColor(p.colorIndex).bg,
                to: `/checklist?fase=${p.phaseId}`,
              }))}
            />
          </div>
        </section>
      </div>

      <section className="card mt-4 p-4 sm:p-6" aria-labelledby="an-owner">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="label-mono">Por responsável</p>
            <h2 id="an-owner" className="mt-1 text-xl">
              Quem está com o quê
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {named.length} {named.length === 1 ? 'responsável' : 'responsáveis'}
              {unassigned ? (
                <>
                  {' · '}
                  <Link to="/checklist?resp=none" className="underline hover:text-primary">
                    {unassigned.total} tarefas sem responsável
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {named.length ? <StatusLegend /> : null}
        </div>
        <div className="mt-5">
          {named.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              <Users className="size-5" aria-hidden />
              <p>
                Nenhuma tarefa tem responsável ainda. Defina quem cuida de cada uma no checklist.
              </p>
              <Link to="/checklist" className="btn-secondary">
                Definir responsáveis
              </Link>
            </div>
          ) : (
            <StackedBars
              title="Tarefas por responsável"
              emptyMessage=""
              scale="max"
              showShare
              rows={named.map((o) => ({
                key: o.key,
                label: o.name,
                sublabel: o.role,
                done: o.done,
                pending: o.pending,
                late: o.late,
                total: o.total,
                pct: o.pct,
                share: o.share,
                to: `/checklist?resp=${encodeURIComponent(o.key)}`,
              }))}
            />
          )}
        </div>
      </section>

      <WhatsAppSection people={s.people} />

      {named.length ? (
        <section className="card mt-4 p-4 sm:p-6" aria-labelledby="an-load">
          <p className="label-mono">Carga por pessoa</p>
          <h2 id="an-load" className="mt-1 text-xl">
            Quanto está com cada um
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fatia das tarefas com responsável definido
            {unassigned ? '; as sem responsável ficam de fora' : ''}.
          </p>
          <Donut
            className="mt-5"
            title="Carga de tarefas por pessoa"
            segments={loadSlices}
            centerValue={String(named.length)}
            centerLabel={named.length === 1 ? 'pessoa' : 'pessoas'}
          />
        </section>
      ) : null}
    </>
  )
}

const KIND_ORDER: NotificationKind[] = [
  'welcome',
  'task_assigned',
  'task_update',
  'due_tomorrow',
  'due_today',
  'overdue',
  'task_done',
  'cost_new',
  'cost_decision',
  'meeting',
  'custom',
]

function kindSummary(byKind: Partial<Record<NotificationKind, number>>): string {
  return KIND_ORDER.filter((k) => byKind[k])
    .map((k) => `${byKind[k]} ${NOTIFICATION_KIND_LABELS[k].toLowerCase()}`)
    .join(' · ')
}

/** Avisos enviados no WhatsApp: totais, por tipo e por pessoa. */
function WhatsAppSection({ people }: { people: Person[] }) {
  const { rows, loading, error } = useNotifications()
  const st = useMemo(() => notificationStats(rows, people), [rows, people])
  if (!SYNC_ENABLED) return null
  const max = Math.max(1, ...st.people.map((p) => p.sent + p.queued))
  return (
    <section className="card mt-4 p-4 sm:p-6" aria-labelledby="an-wa">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="label-mono">WhatsApp</p>
          <h2 id="an-wa" className="mt-1 text-xl">
            Avisos disparados
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Carregando…'
              : error
                ? `Não foi possível ler a fila: ${error}`
                : st.sent === 0 && st.queued === 0
                  ? 'Nenhum aviso enviado ainda.'
                  : kindSummary(st.byKind) || 'Só mensagens na fila por enquanto.'}
          </p>
        </div>
        <Link to="/usuarios" className="btn-ghost h-8 px-2.5 py-0 text-xs">
          <MessageCircle className="size-3.5" aria-hidden /> Configurar avisos
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {(
          [
            ['Enviadas', st.sent, ''],
            ['Na fila', st.queued, ''],
            ['Com falha', st.failed, st.failed ? 'text-danger' : ''],
          ] as const
        ).map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <p className="label-mono">{label}</p>
            <p className={`mt-0.5 font-display text-2xl tabular-nums ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {st.people.length ? (
        <ul className="mt-5 grid gap-3" aria-label="Avisos por pessoa">
          {st.people.map((p) => (
            <li key={p.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold" title={p.name}>
                    {p.name}
                  </span>
                  {p.role ? (
                    <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 font-display text-[0.625rem] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                      {p.role}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <strong className="text-foreground">{p.sent}</strong>{' '}
                  {p.sent === 1 ? 'enviada' : 'enviadas'}
                  {p.queued ? ` · ${p.queued} na fila` : ''}
                  {p.failed ? <span className="text-danger"> · {p.failed} com falha</span> : ''}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${p.name}: ${p.sent} enviadas, ${p.queued} na fila, ${p.failed} com falha`}
              >
                <div
                  className="h-full rounded-full bg-aqua"
                  style={{ width: `${((p.sent + p.queued) / max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {kindSummary(p.byKind) || 'nada enviado ainda'}
                {p.lastSentAt
                  ? ` · último em ${new Date(p.lastSentAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
