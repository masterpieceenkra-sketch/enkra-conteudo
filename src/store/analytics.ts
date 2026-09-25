import type { LaunchState, Person, Task } from '../data/types'
import { addDays, type IsoDate } from '../lib/dates'
import { allTasks, progressOf } from './launchStore'

/**
 * Seletores da página Analytics. Puros: recebem o estado e a data de hoje, sem hooks.
 * "Pendente" aqui é não concluída e no prazo; "atrasada" é não concluída com prazo vencido.
 * Assim concluídas + pendentes + atrasadas = total, e o donut fecha 100%.
 */

export const UNASSIGNED_KEY = 'none'
export const UNASSIGNED_LABEL = 'Sem responsável'

export interface StatBucket {
  total: number
  done: number
  /** não concluídas e no prazo (ou sem prazo) */
  pending: number
  /** não concluídas com prazo anterior a hoje */
  late: number
  /** 0–100 arredondado, igual a progressOf */
  pct: number
}

export interface OverallStats extends StatBucket {
  /** pendentes sem prazo definido */
  noDue: number
  /** não concluídas que vencem de hoje até daqui a DUE_SOON_DAYS dias */
  soon: number
}

export interface OwnerRef {
  /** 'p:<personId>' | 't:<texto normalizado>' | 'none'; é o valor de ?resp= no checklist */
  key: string
  name: string
  role?: string
  personId?: string
}

export interface OwnerStats extends StatBucket, OwnerRef {
  /** fatia do total de tarefas, 0–100 sem arredondar */
  share: number
  unassigned: boolean
}

export interface PhaseStats extends StatBucket {
  phaseId: string
  name: string
  /** índice da fase em s.phases, para phaseColor(index) */
  colorIndex: number
  share: number
}

export type DistributionKey = 'done' | 'pending' | 'late'

export interface DistributionSlice {
  key: DistributionKey
  label: string
  value: number
  /** 0–100 sem arredondar; soma 100 quando total > 0 */
  pct: number
}

export const STATUS_LABELS: Record<DistributionKey, string> = {
  done: 'Concluídas',
  pending: 'Pendentes',
  late: 'Atrasadas',
}

export function isLate(t: Task, today: IsoDate): boolean {
  return !t.done && t.due !== '' && t.due < today
}

/** Janela do "a vencer": hoje e os próximos dois dias. */
export const DUE_SOON_DAYS = 2

/**
 * Tarefa a vencer: não concluída, com prazo entre hoje e hoje + `days`.
 * Atrasada não entra aqui (já venceu); é um recorte das pendentes, para ver o que aperta agora.
 */
export function isDueSoon(t: Task, today: IsoDate, days = DUE_SOON_DAYS): boolean {
  return !t.done && t.due !== '' && t.due >= today && t.due <= addDays(today, days)
}

export function dueSoonTasks(s: LaunchState, today: IsoDate, days = DUE_SOON_DAYS): Task[] {
  return allTasks(s)
    .filter((t) => isDueSoon(t, today, days))
    .sort((a, b) => a.due.localeCompare(b.due))
}

export function statsOf(tasks: Task[], today: IsoDate): StatBucket {
  const { done, total, pct } = progressOf(tasks)
  const late = tasks.filter((t) => isLate(t, today)).length
  return { total, done, pending: total - done - late, late, pct }
}

export function overallStats(s: LaunchState, today: IsoDate): OverallStats {
  const tasks = allTasks(s)
  const noDue = tasks.filter((t) => !t.done && t.due === '').length
  const soon = tasks.filter((t) => isDueSoon(t, today)).length
  return { ...statsOf(tasks, today), noDue, soon }
}

export function distribution(stats: StatBucket): DistributionSlice[] {
  const pct = (v: number) => (stats.total > 0 ? (v / stats.total) * 100 : 0)
  return (['done', 'pending', 'late'] as const).map((key) => ({
    key,
    label: STATUS_LABELS[key],
    value: stats[key],
    pct: pct(stats[key]),
  }))
}

const norm = (v: string) =>
  v.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0 && a.trim() !== ''
}

/**
 * Identidade do responsável de uma tarefa:
 * 1. `ownerId` de alguém do cadastro → essa pessoa (nome e cargo do cadastro);
 * 2. texto igual ao nome de alguém do cadastro → essa pessoa;
 * 3. texto solto ("Comu", "Gimena") → grupo próprio pelo texto normalizado;
 * 4. nada → "Sem responsável".
 */
export function resolveOwner(t: Task, people: Person[]): OwnerRef {
  return resolveOwners(t, people)[0]
}

function personRef(person: Person): OwnerRef {
  return {
    key: `p:${person.id}`,
    name: person.name,
    personId: person.id,
    ...(person.role ? { role: person.role } : {}),
  }
}

/** Todos os responsáveis da tarefa (um por pessoa em `ownerIds`); sempre ao menos um item. */
export function resolveOwners(t: Task, people: Person[]): OwnerRef[] {
  const ids = t.ownerIds ?? (t.ownerId ? [t.ownerId] : [])
  const found = ids.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p)
  if (found.length) return found.map(personRef)
  const text = t.owner.trim()
  const byName = text ? people.find((p) => sameName(p.name, text)) : undefined
  if (byName) return [personRef(byName)]
  if (text) return [{ key: `t:${norm(text)}`, name: text }]
  return [{ key: UNASSIGNED_KEY, name: UNASSIGNED_LABEL }]
}

export function byOwner(s: LaunchState, today: IsoDate): OwnerStats[] {
  const tasks = allTasks(s)
  const groups = new Map<string, { ref: OwnerRef; tasks: Task[] }>()
  for (const t of tasks) {
    for (const ref of resolveOwners(t, s.people)) {
      const g = groups.get(ref.key)
      if (g) g.tasks.push(t)
      else groups.set(ref.key, { ref, tasks: [t] })
    }
  }
  const out: OwnerStats[] = []
  for (const { ref, tasks: ts } of groups.values()) {
    out.push({
      ...ref,
      ...statsOf(ts, today),
      share: tasks.length ? (ts.length / tasks.length) * 100 : 0,
      unassigned: ref.key === UNASSIGNED_KEY,
    })
  }
  return out.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1
    return b.total - a.total || a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function byPhase(s: LaunchState, today: IsoDate): PhaseStats[] {
  const all = allTasks(s).length
  return s.phases.map((p, i) => {
    const ts = p.areas.flatMap((a) => a.tasks)
    return {
      phaseId: p.id,
      name: p.name,
      colorIndex: i,
      ...statsOf(ts, today),
      share: all ? (ts.length / all) * 100 : 0,
    }
  })
}

/** Usado pelo checklist para o filtro ?resp=. */
export function ownerMatches(t: Task, resp: string, people: Person[]): boolean {
  return resolveOwners(t, people).some((o) => o.key === resp)
}

/** Nome legível de uma chave ?resp= (para o chip do checklist). */
export function ownerLabel(resp: string, s: LaunchState): string {
  if (resp === UNASSIGNED_KEY) return UNASSIGNED_LABEL
  if (resp.startsWith('p:')) return s.people.find((p) => p.id === resp.slice(2))?.name ?? resp
  if (resp.startsWith('t:')) {
    const key = resp.slice(2)
    const t = allTasks(s).find((x) => x.owner.trim() && norm(x.owner) === key)
    return t ? t.owner.trim() : key
  }
  return resp
}

// ---------- Avisos no WhatsApp ----------

export type NotificationKind =
  | 'welcome'
  | 'task_assigned'
  | 'task_update'
  | 'due_tomorrow'
  | 'due_today'
  | 'overdue'
  | 'task_done'
  | 'cost_new'
  | 'cost_decision'
  | 'meeting'
  | 'custom'
export type NotificationStatus = 'queued' | 'sent' | 'failed'

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  welcome: 'Boas-vindas',
  task_assigned: 'Tarefa atribuída',
  task_update: 'Tarefa atualizada',
  due_tomorrow: 'Prazo amanhã',
  due_today: 'Prazo hoje',
  overdue: 'Tarefa atrasada',
  task_done: 'Tarefa concluída',
  cost_new: 'Custo publicado',
  cost_decision: 'Custo decidido',
  meeting: 'Reunião',
  custom: 'Mensagem',
}

/** Linha da tabela `comu_hub_notifications` (só o que a página usa). */
export interface NotificationRow {
  id: number
  kind: string
  person_id: string | null
  person_name: string
  status: string
  created_at: string
}

export interface PersonNotificationStats {
  key: string
  name: string
  role?: string
  sent: number
  queued: number
  failed: number
  byKind: Partial<Record<NotificationKind, number>>
  lastSentAt: string | null
}

export interface NotificationStats {
  sent: number
  queued: number
  failed: number
  byKind: Partial<Record<NotificationKind, number>>
  people: PersonNotificationStats[]
}

const isKind = (k: string): k is NotificationKind => k in NOTIFICATION_KIND_LABELS

/** Agrega os avisos por pessoa (nome e cargo atuais do cadastro, quando ainda existe) e por tipo. */
export function notificationStats(rows: NotificationRow[], people: Person[]): NotificationStats {
  const out: NotificationStats = { sent: 0, queued: 0, failed: 0, byKind: {}, people: [] }
  const map = new Map<string, PersonNotificationStats>()
  for (const r of rows) {
    const status = r.status as NotificationStatus
    if (status !== 'sent' && status !== 'queued' && status !== 'failed') continue
    out[status]++
    const person = r.person_id ? people.find((p) => p.id === r.person_id) : undefined
    const key = person ? `p:${person.id}` : `n:${r.person_name.trim().toLocaleLowerCase('pt-BR')}`
    let ps = map.get(key)
    if (!ps) {
      ps = {
        key,
        name: person?.name ?? r.person_name.trim(),
        ...(person?.role ? { role: person.role } : {}),
        sent: 0,
        queued: 0,
        failed: 0,
        byKind: {},
        lastSentAt: null,
      }
      map.set(key, ps)
    }
    ps[status]++
    if (status === 'sent') {
      if (isKind(r.kind)) {
        ps.byKind[r.kind] = (ps.byKind[r.kind] ?? 0) + 1
        out.byKind[r.kind] = (out.byKind[r.kind] ?? 0) + 1
      }
      if (!ps.lastSentAt || r.created_at > ps.lastSentAt) ps.lastSentAt = r.created_at
    }
  }
  out.people = [...map.values()].sort(
    (a, b) => b.sent - a.sent || b.queued - a.queued || a.name.localeCompare(b.name, 'pt-BR'),
  )
  return out
}
