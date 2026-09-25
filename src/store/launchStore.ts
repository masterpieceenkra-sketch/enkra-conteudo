import { useCallback, useSyncExternalStore } from 'react'
import { BRIEF_SECTIONS } from '../data/brief'
import { templateMilestones, templatePhaseIds, templatePhases } from '../data/boardTemplates'
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_PREF_LABELS,
  OVERDUE_EVERY_OPTIONS,
  phaseHasDates,
} from '../data/types'
import {
  MESSAGE_KINDS,
  defaultTemplate,
  MESSAGE_KIND_INFO,
  TEMPLATE_MAX_LENGTH,
  type MessageKind,
} from '../data/messageTemplates'
import { DEFAULT_LABELS, isHttpUrl, isLabelColor } from '../data/labels'
import { DEFAULT_LAUNCH_START, defaultPhaseDates } from '../data/phases'
import type {
  Area,
  BoardKind,
  ChecklistItem,
  Label,
  LaunchState,
  Meeting,
  Milestone,
  Person,
  Phase,
  Task,
  TaskChecklist,
  NotificationPrefs,
} from '../data/types'
import { APP_FLAVOR, APP_NAME, storageKey } from '../lib/board'
import { defaultContent, parseContent } from '../content/model'
import { diffDays, isValidIso, type IsoDate } from '../lib/dates'
import type { ActivityInput } from './activity'
import { SyncEngine, type Actor, type Reducer, type SyncTransport } from './sync'

export const STORAGE_KEY = storageKey('gps-lancamento-v2')
/** Chave usada pela versão anterior do app (só leitura, para migrar). */
const LEGACY_KEY = 'gc-hub-lancamento-v1'

// ---------- IDs ----------

let counter = 0
export function newId(prefix: string): string {
  counter += 1
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}${counter}_${rand}`
}

// ---------- Estado inicial ----------

export function buildInitialState(
  launchStart: IsoDate = DEFAULT_LAUNCH_START,
  kind: BoardKind = APP_FLAVOR === 'content' ? 'content' : 'launch',
): LaunchState {
  // quadro de conteúdo não tem fases nem marcos: o trabalho vive em `content`
  const isContent = kind === 'content'
  return {
    version: 2,
    kind,
    launchStart,
    brief: {},
    phases: isContent ? [] : templatePhases(kind, launchStart),
    labels: DEFAULT_LABELS.map((l) => ({ ...l })),
    milestones: isContent ? [] : templateMilestones(kind, launchStart),
    meetings: [],
    people: [],
    notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    diary: {},
    ...(isContent ? { content: defaultContent() } : {}),
    updatedAt: new Date().toISOString(),
  }
}

// ---------- Migração / validação ----------

interface LegacyState {
  brief?: Record<string, string>
  phases?: { id: string; name: string; start: string; end: string }[]
  milestones?: Milestone[]
  tasks?: Record<string, { done?: boolean; owner?: string; due?: string }>
  diary?: Record<string, string>
}

/** Converte o formato v1 (tarefas por id, estrutura fixa) para o v2 (estrutura editável). */
export function migrateLegacy(legacy: LegacyState): LaunchState {
  const base = buildInitialState()
  const byId = new Map(legacy.phases?.map((p) => [p.id, p]) ?? [])
  const phases = base.phases.map((p) => {
    const old = byId.get(p.id)
    return {
      ...p,
      name: old?.name ?? p.name,
      start: old?.start && isValidIso(old.start) ? old.start : p.start,
      end: old?.end && isValidIso(old.end) ? old.end : p.end,
      areas: p.areas.map((a) => ({
        ...a,
        tasks: a.tasks.map((t) => {
          const s = legacy.tasks?.[t.id]
          return { ...t, done: !!s?.done, owner: s?.owner ?? '', due: s?.due ?? '' }
        }),
      })),
    }
  })
  const diary: Record<string, string> = {}
  for (const [k, v] of Object.entries(legacy.diary ?? {})) {
    // v1 usava `${phaseId}-${AREA}`; v2 usa `${phaseId}:${AREA}`
    const m = /^(f\d+)-(.+)$/.exec(k)
    diary[m ? `${m[1]}:${m[2]}` : k] = v
  }
  return {
    ...base,
    brief: stringRecord(legacy.brief),
    phases,
    milestones: legacy.milestones?.length ? legacy.milestones : base.milestones,
    diary: stringRecord(diary),
  }
}

/**
 * Fases que entraram no modelo depois de o usuário já ter dados salvos são inseridas na
 * posição do modelo, sem tocar nas fases existentes. Vale só para quadro de lançamento que
 * ainda não teve as fases mexidas à mão: quem cria ou apaga fase liga `phasesCustom` e a
 * partir daí manda na própria estrutura.
 */
function mergeTemplatePhases(phases: Phase[], launchStart: IsoDate): Phase[] {
  const have = new Set(phases.map((p) => p.id))
  const missing = templatePhases('launch', launchStart).filter((p) => !have.has(p.id))
  if (missing.length === 0) return phases
  const templateOrder = templatePhaseIds('launch')
  const merged = [...phases, ...missing]
  return merged.sort((a, b) => {
    const ia = templateOrder.indexOf(a.id)
    const ib = templateOrder.indexOf(b.id)
    // fases criadas fora do modelo ficam no fim, na ordem em que estavam
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })
}

/** Etiquetas do estado salvo; sem o campo (estado antigo) entram as padrão. */
function parseLabels(raw: unknown): Label[] {
  if (!Array.isArray(raw)) return DEFAULT_LABELS.map((l) => ({ ...l }))
  const out: Label[] = []
  const seen = new Set<string>()
  for (const l of raw as Partial<Label>[]) {
    if (!l || typeof l.id !== 'string' || typeof l.name !== 'string' || seen.has(l.id)) continue
    seen.add(l.id)
    out.push({ id: l.id, name: l.name, color: isLabelColor(l.color) ? l.color : 'gray' })
  }
  return out
}

/** Responsáveis do cadastro: `ownerIds` (lista) e `ownerId` (o primeiro), aceitando estados antigos só com `ownerId`. */
function parseOwners(t: Partial<Task>): Pick<Task, 'ownerId' | 'ownerIds'> {
  const ids = Array.isArray(t.ownerIds)
    ? [...new Set(t.ownerIds.filter((x): x is string => typeof x === 'string' && x !== ''))]
    : typeof t.ownerId === 'string' && t.ownerId
      ? [t.ownerId]
      : []
  return ids.length ? { ownerId: ids[0], ownerIds: ids } : {}
}

/** Quantos números uma pessoa pode ter no cadastro. */
export const MAX_PHONES = 4

/** Números da pessoa (só dígitos), o principal primeiro. Mesma regra da SQL `comu_hub_person_phones`. */
export function personPhones(p: Pick<Person, 'phone' | 'phones'>): string[] {
  const list = (Array.isArray(p.phones) ? p.phones : [p.phone])
    .map((v) => (typeof v === 'string' ? normalizePhone(v) : ''))
    .filter(Boolean)
  return [...new Set(list)]
}

/** Telefones normalizados para gravar: o principal primeiro, sem repetidos nem vazios. */
export function withPhones(list: string[]): Pick<Person, 'phone' | 'phones'> {
  const phones = [...new Set(list.map(normalizePhone).filter(Boolean))]
  return { phone: phones[0] ?? '', ...(phones.length > 1 ? { phones } : {}) }
}

/** Pessoa do cadastro por qualquer um dos números dela, como o login identifica. */
export function personByPhone(s: LaunchState, phone: string): Person | undefined {
  return phone ? s.people.find((p) => personPhones(p).includes(phone)) : undefined
}

/** Texto do campo "responsável" a partir dos ids; ids sem cadastro ficam de fora. */
export function ownerText(ids: string[], people: Person[]): string {
  return ids
    .map((id) => people.find((p) => p.id === id)?.name ?? '')
    .filter(Boolean)
    .join(', ')
}

/** Aplica uma lista de responsáveis do cadastro numa tarefa, mantendo `owner`/`ownerId` coerentes. */
function withOwners(t: Task, ids: string[], people: Person[]): Task {
  const { ownerId: _a, ownerIds: _b, ...rest } = t
  if (!ids.length) return { ...rest, owner: '' }
  return { ...rest, owner: ownerText(ids, people), ownerId: ids[0], ownerIds: ids }
}

/** Campos opcionais do card: etiquetas, link, descrição e checklists. */
function parseTaskExtras(
  t: Partial<Task>,
): Pick<Task, 'labelIds' | 'link' | 'description' | 'checklists'> {
  const out: Pick<Task, 'labelIds' | 'link' | 'description' | 'checklists'> = {}
  if (Array.isArray(t.labelIds)) {
    const ids = t.labelIds.filter((x): x is string => typeof x === 'string')
    if (ids.length) out.labelIds = [...new Set(ids)]
  }
  if (typeof t.link === 'string' && isHttpUrl(t.link)) out.link = t.link
  if (typeof t.description === 'string' && t.description.trim()) out.description = t.description
  if (Array.isArray(t.checklists)) {
    const lists: TaskChecklist[] = []
    for (const c of t.checklists as Partial<TaskChecklist>[]) {
      if (!c || typeof c.id !== 'string') continue
      const items: ChecklistItem[] = (
        Array.isArray(c.items) ? (c.items as Partial<ChecklistItem>[]) : []
      )
        .filter((i) => i && typeof i.id === 'string' && typeof i.text === 'string')
        .map((i) => ({ id: i.id!, text: i.text!, done: !!i.done }))
      lists.push({ id: c.id, title: typeof c.title === 'string' ? c.title : 'Checklist', items })
    }
    if (lists.length) out.checklists = lists
  }
  return out
}

/** Mantém só entradas cujo valor é string (import de JSON externo). */
function stringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function isTask(t: unknown): t is Task {
  return (
    !!t &&
    typeof t === 'object' &&
    typeof (t as Task).id === 'string' &&
    typeof (t as Task).label === 'string'
  )
}

/** Aceita qualquer JSON e devolve um LaunchState válido (ou lança). */
export function parseState(raw: unknown): LaunchState {
  if (!raw || typeof raw !== 'object') throw new Error('Arquivo inválido')
  const obj = raw as Partial<LaunchState> & LegacyState
  if (obj.version !== 2) {
    if (obj.tasks || (obj.phases && obj.phases.length && !('areas' in obj.phases[0]))) {
      return migrateLegacy(obj)
    }
    throw new Error('Formato não reconhecido')
  }
  if (!Array.isArray(obj.phases)) throw new Error('Fases ausentes')
  const seenTaskIds = new Set<string>()
  const phases: Phase[] = obj.phases.map((p, i) => ({
    id: typeof p.id === 'string' ? p.id : `f${i + 1}`,
    name: String(p.name ?? `Fase ${i + 1}`),
    start: isValidIso(p.start) ? p.start : '',
    end: isValidIso(p.end) ? p.end : '',
    areas: (Array.isArray(p.areas) ? p.areas : []).map((a, j) => ({
      id: typeof a.id === 'string' ? a.id : `${p.id}:${j}`,
      name: String(a.name ?? 'ÁREA'),
      tasks: (Array.isArray(a.tasks) ? a.tasks : [])
        .filter(isTask)
        .filter((t) => {
          if (seenTaskIds.has(t.id)) return false
          seenTaskIds.add(t.id)
          return true
        })
        .map((t) => ({
          id: t.id,
          label: t.label,
          done: !!t.done,
          owner: typeof t.owner === 'string' ? t.owner : '',
          due: typeof t.due === 'string' && (t.due === '' || isValidIso(t.due)) ? t.due : '',
          ...(t.custom ? { custom: true } : {}),
          ...parseOwners(t),
          ...parseTaskExtras(t),
        })),
    })),
  }))
  const launchStart = isValidIso(obj.launchStart ?? '') ? obj.launchStart! : DEFAULT_LAUNCH_START
  const labels = parseLabels(obj.labels)
  const labelIds = new Set(labels.map((l) => l.id))
  // referências a etiquetas que não existem mais são descartadas
  for (const p of phases)
    for (const a of p.areas)
      for (const t of a.tasks)
        if (t.labelIds) t.labelIds = t.labelIds.filter((id) => labelIds.has(id))
  const kind = parseBoardKind(obj.kind)
  // gravada pelo servidor; o commit recusa mudança, então só repassamos adiante
  const url = typeof obj.url === 'string' ? obj.url.slice(0, 300) : ''
  const phasesCustom = obj.phasesCustom === true
  const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 60) : ''
  return {
    version: 2,
    ...(name ? { name } : {}),
    kind,
    ...(url ? { url } : {}),
    ...(phasesCustom ? { phasesCustom: true } : {}),
    launchStart,
    brief: stringRecord(obj.brief),
    phases: kind === 'launch' && !phasesCustom ? mergeTemplatePhases(phases, launchStart) : phases,
    labels,
    milestones: Array.isArray(obj.milestones)
      ? obj.milestones
          .filter((m) => m && typeof m.id === 'string')
          .map((m) => ({
            id: m.id,
            label: String(m.label ?? ''),
            date: isValidIso(m.date) ? m.date : '',
          }))
      : [],
    meetings: parseMeetings(obj.meetings),
    people: parsePeople(obj.people),
    notifications: parseNotificationPrefs(obj.notifications),
    ...parseMessages(obj.messages, kind === 'content'),
    diary: stringRecord(obj.diary),
    ...(kind === 'content' ? { content: parseContent(obj.content) } : {}),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  }
}

/** Modelos de mensagem editados; só entram os que diferem do padrão e cabem no limite. */
function parseMessages(raw: unknown, content: boolean): Pick<LaunchState, 'messages'> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Partial<Record<MessageKind, string>> = {}
  for (const k of MESSAGE_KINDS) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v !== 'string') continue
    const t = v.trim().slice(0, TEMPLATE_MAX_LENGTH)
    if (t && t !== defaultTemplate(k, content)) out[k] = t
  }
  return Object.keys(out).length ? { messages: out } : {}
}

/** Modelo do quadro; sem o campo (estado antigo) é lançamento. */
function parseBoardKind(raw: unknown): BoardKind {
  return raw === 'sprint' || raw === 'blank' || raw === 'content' ? raw : 'launch'
}

/** Preferências de aviso; sem o campo (estado antigo) tudo fica ligado. */
function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const out = { ...DEFAULT_NOTIFICATION_PREFS }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<Record<keyof NotificationPrefs, unknown>>
  if (typeof r.taskAssigned === 'boolean') out.taskAssigned = r.taskAssigned
  if (typeof r.taskAssignedRequireDue === 'boolean')
    out.taskAssignedRequireDue = r.taskAssignedRequireDue
  if (typeof r.dueTomorrow === 'boolean') out.dueTomorrow = r.dueTomorrow
  if (typeof r.dueToday === 'boolean') out.dueToday = r.dueToday
  if (typeof r.overdue === 'boolean') out.overdue = r.overdue
  if (typeof r.taskDone === 'boolean') out.taskDone = r.taskDone
  if (typeof r.costNew === 'boolean') out.costNew = r.costNew
  if (typeof r.costDecision === 'boolean') out.costDecision = r.costDecision
  for (const k of [
    'cardAssigned',
    'cardDue',
    'contentReview',
    'contentDecision',
    'contentComment',
    'contentPublishToday',
  ] as const)
    if (typeof r[k] === 'boolean') out[k] = r[k] as boolean
  out.overdueEveryDays = normalizeOverdueEvery(r.overdueEveryDays)
  out.overdueHour = normalizeOverdueHour(r.overdueHour)
  return out
}

/** Hora cheia da cobrança de atraso; 9h quando vier lixo. */
export function normalizeOverdueHour(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.round(raw) : NaN
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 9
}

/** Frequência da cobrança de atraso: só os intervalos da tela, 1 dia quando vier lixo. */
export function normalizeOverdueEvery(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.round(raw) : NaN
  return OVERDUE_EVERY_OPTIONS.includes(n as (typeof OVERDUE_EVERY_OPTIONS)[number]) ? n : 1
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export function isValidTime(v: string): boolean {
  return TIME_RE.test(v)
}

export function normalizePhone(v: string): string {
  let d = v.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = `55${d}`
  return d
}

function parsePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return []
  const out: Person[] = []
  const seen = new Set<string>()
  for (const p of raw as Partial<Person>[]) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || seen.has(p.id)) continue
    seen.add(p.id)
    const phones = personPhones({
      phone: typeof p.phone === 'string' ? p.phone : '',
      phones: Array.isArray(p.phones) ? p.phones.slice(0, MAX_PHONES) : undefined,
    })
    out.push({
      id: p.id,
      name: p.name,
      email: typeof p.email === 'string' ? p.email : '',
      ...withPhones(phones),
      ...(typeof p.role === 'string' && p.role.trim() ? { role: p.role.trim().slice(0, 60) } : {}),
      notify: p.notify !== false,
      ...(p.admin === true ? { admin: true } : {}),
      ...(p.admin === true && p.finance === true ? { finance: true } : {}),
      ...(p.admin !== true && p.client === true ? { client: true } : {}),
    })
  }
  return out
}

/** Resumo de reunião: uma ata do Tactiq tem ~5 mil caracteres; 40 mil dá folga. */
export const SUMMARY_MAX_LENGTH = 40_000

function parseMeetings(raw: unknown): Meeting[] {
  if (!Array.isArray(raw)) return []
  const out: Meeting[] = []
  const seen = new Set<string>()
  for (const m of raw as Partial<Meeting>[]) {
    if (!m || typeof m.id !== 'string' || typeof m.title !== 'string' || seen.has(m.id)) continue
    if (typeof m.date !== 'string' || !isValidIso(m.date)) continue
    seen.add(m.id)
    out.push({
      id: m.id,
      title: m.title,
      date: m.date,
      time: typeof m.time === 'string' && isValidTime(m.time) ? m.time : '',
      durationMin:
        typeof m.durationMin === 'number' && m.durationMin > 0 && m.durationMin <= 24 * 60
          ? Math.round(m.durationMin)
          : 60,
      link: typeof m.link === 'string' && isHttpUrl(m.link) ? m.link : '',
      agenda: typeof m.agenda === 'string' ? m.agenda : '',
      ...(typeof m.summary === 'string' && m.summary.trim()
        ? { summary: m.summary.slice(0, SUMMARY_MAX_LENGTH) }
        : {}),
      ...(Array.isArray(m.attendeeIds)
        ? { attendeeIds: m.attendeeIds.filter((x): x is string => typeof x === 'string') }
        : {}),
    })
  }
  return out
}

// ---------- Persistência ----------

type Listener = () => void
const listeners = new Set<Listener>()
let state: LaunchState | null = null
let saveStatus: 'idle' | 'saved' | 'error' = 'idle'
let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Onde um blob ilegível é preservado antes de o app seguir com estado novo. */
export const UNREADABLE_KEY = `${STORAGE_KEY}.unreadable`
/** Snapshot do estado anterior a um import ou reset (um slot, sobrescrito a cada vez). */
export const PREVIOUS_KEY = `${STORAGE_KEY}.previous`
const PERSIST_DELAY_MS = 200

export function load(): LaunchState {
  if (state) return state
  if (typeof window === 'undefined') return (state = buildInitialState())
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return (state = parseState(JSON.parse(raw)))
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      state = migrateLegacy(JSON.parse(legacy))
      writeNow(state)
      return state
    }
  } catch {
    // Dados ilegíveis (versão futura, JSON quebrado): guarda o blob intacto em outra chave
    // antes de seguir, para que o próximo salvamento não destrua o que o usuário tinha.
    if (raw) {
      try {
        window.localStorage.setItem(UNREADABLE_KEY, raw)
      } catch {
        // sem espaço: nada mais a fazer além de não sobrescrever silenciosamente
      }
    }
  }
  return (state = buildInitialState())
}

function writeNow(next: LaunchState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    saveStatus = 'saved'
  } catch {
    saveStatus = 'error'
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
let pending: LaunchState | null = null

/** Grava no navegador com debounce: digitação contínua vira uma escrita, não uma por tecla. */
function persist(next: LaunchState) {
  pending = next
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(flush, PERSIST_DELAY_MS)
}

function flush() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (!pending) return
  writeNow(pending)
  pending = null
  emit()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveStatus = 'idle'
    emit()
  }, 1800)
}

function emit() {
  listeners.forEach((l) => l())
}

function setState(next: LaunchState) {
  state = next
  persist(next)
  emit()
}

export function subscribe(l: Listener) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ---------- Sincronização com o servidor ----------

let sync: SyncEngine | null = null

/** Liga a sincronização. Sem transporte (sem env), o app fica só no navegador. */
export function startSync(
  transport: SyncTransport | null,
  launchId: string,
  actor: () => Actor,
): SyncEngine {
  sync?.stop()
  sync = new SyncEngine(transport, launchId, {
    getLocal: load,
    parse: parseState,
    actor,
    setFromServer: (server, pendingReducers) => {
      let s = server
      for (const r of pendingReducers) s = r(s)
      setState(s)
    },
  })
  void sync.start()
  return sync
}

export function getSync(): SyncEngine | null {
  return sync
}

if (typeof window !== 'undefined') {
  // Não perder a última edição ao fechar a aba ou trocar de app no celular.
  const flushAll = () => {
    flush()
    void sync?.flush({ keepalive: true })
  }
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
    else void sync?.refresh()
  })
  // Outra aba deste navegador gravou no cache local.
  // Com servidor: a fonte da verdade é ele; busca a versão nova e reaplica o que está pendente aqui.
  // Ler o cache da outra aba nesse caso poderia apagar uma edição que ainda não subiu (ex.: descrição
  // sendo digitada) e o próximo commit mandaria o estado velho para o servidor.
  // Sem servidor: descarta o cache em memória para não sobrescrever o que a outra aba gravou.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    if (sync) {
      void sync.refresh()
      return
    }
    state = null
    emit()
  })
}

/**
 * Aplica um redutor puro ao estado atual, grava no navegador e enfileira para o servidor.
 * Todas as ações passam por aqui; o redutor é reaplicado se o servidor mudou no meio.
 */
function apply(reduce: Reducer, event?: ActivityInput) {
  const base = load()
  const next = reduce(base)
  if (next === base) return
  setState({ ...next, updatedAt: new Date().toISOString() })
  sync?.enqueue(reduce, event)
}

/** Mesma porta de `apply` para os módulos de fora (hub de conteúdo). */
export function mutate(reduce: Reducer, event?: ActivityInput) {
  apply(reduce, event)
}

/** Só para testes. */
export function __resetStoreForTests() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  pending = null
  state = null
  saveStatus = 'idle'
  listeners.clear()
  sync?.stop()
  sync = null
}

/** Só para testes: grava imediatamente o que estiver pendente. */
export function __flushForTests() {
  flush()
}

// ---------- Hooks ----------

export function useLaunchState(): LaunchState {
  return useSyncExternalStore(subscribe, load, load)
}

export function useSaveStatus() {
  return useSyncExternalStore(
    subscribe,
    () => saveStatus,
    () => 'idle' as const,
  )
}

function updatePhase(s: LaunchState, phaseId: string, fn: (p: Phase) => Phase): LaunchState {
  return { ...s, phases: s.phases.map((p) => (p.id === phaseId ? fn(p) : p)) }
}

function updateArea(s: LaunchState, areaId: string, fn: (a: Area) => Area): LaunchState {
  return {
    ...s,
    phases: s.phases.map((p) => ({
      ...p,
      areas: p.areas.map((a) => (a.id === areaId ? fn(a) : a)),
    })),
  }
}

function updateTask(s: LaunchState, taskId: string, fn: (t: Task) => Task): LaunchState {
  return {
    ...s,
    phases: s.phases.map((p) => ({
      ...p,
      areas: p.areas.map((a) => ({
        ...a,
        tasks: a.tasks.map((t) => (t.id === taskId ? fn(t) : t)),
      })),
    })),
  }
}

function findArea(s: LaunchState, areaId: string): Area | undefined {
  for (const p of s.phases) for (const a of p.areas) if (a.id === areaId) return a
  return undefined
}

const briefLabel = (id: string) =>
  BRIEF_SECTIONS.flatMap((sec) => sec.fields).find((f) => f.id === id)?.label ?? id
const short = (v: string, n = 120) => (v.length > n ? `${v.slice(0, n)}…` : v)

export function useLaunchActions() {
  const setBrief = useCallback((id: string, value: string) => {
    apply((s) => ({ ...s, brief: { ...s.brief, [id]: value } }), {
      action: 'brief.set',
      entityType: 'brief',
      entityId: id,
      entityLabel: briefLabel(id),
      details: { value: short(value) },
    })
  }, [])

  const setDiary = useCallback((key: string, value: string) => {
    apply((s) => ({ ...s, diary: { ...s.diary, [key]: value } }), {
      action: 'diary.set',
      entityType: 'diary',
      entityId: key,
      entityLabel: key.replace(':', ' · '),
      details: { value: short(value) },
    })
  }, [])

  const patchTask = useCallback((taskId: string, patch0: Partial<Omit<Task, 'id'>>) => {
    let patch = patch0
    if (patch.due !== undefined && patch.due !== '' && !isValidIso(patch.due)) return
    if (patch.link !== undefined && patch.link !== '' && !isHttpUrl(patch.link)) return
    const before = findTask(load(), taskId)
    if (!before) return
    let event: ActivityInput | undefined
    const base = {
      entityType: 'task' as const,
      entityId: taskId,
      entityLabel: patch.label ?? before.label,
    }
    if (patch.done !== undefined && patch.done !== before.done)
      event = { ...base, action: patch.done ? 'task.done' : 'task.undone' }
    else if (patch.label !== undefined && patch.label !== before.label)
      event = { ...base, action: 'task.rename', details: { from: before.label, to: patch.label } }
    else if (
      (patch.owner !== undefined && patch.owner !== before.owner) ||
      (patch.ownerId !== undefined && patch.ownerId !== before.ownerId)
    )
      event = {
        ...base,
        action: 'task.owner',
        details: {
          to: patch.owner ?? before.owner,
          ownerId: patch.ownerId ?? null,
          due: patch.due ?? before.due,
        },
      }
    else if (patch.due !== undefined && patch.due !== before.due)
      event = { ...base, action: 'task.due', details: { to: patch.due } }
    if (patch.owner !== undefined || patch.ownerId !== undefined) {
      // caminho antigo (um responsável só): a lista acompanha
      patch = { ...patch, ownerIds: patch.ownerId ? [patch.ownerId] : undefined }
      if (event?.action === 'task.owner')
        event = {
          ...event,
          details: {
            ...event.details,
            ownerIds: patch.ownerIds ?? [],
            added:
              patch.ownerId && !before.ownerIds?.includes(patch.ownerId) ? [patch.ownerId] : [],
          },
        }
    } else if (patch.link !== undefined && patch.link !== (before.link ?? ''))
      event = { ...base, action: 'task.link', details: { to: patch.link } }
    else if (patch.description !== undefined && patch.description !== (before.description ?? ''))
      event = { ...base, action: 'task.description', details: { value: short(patch.description) } }
    apply((s) => updateTask(s, taskId, (t) => ({ ...t, ...patch })), event)
  }, [])

  /** Define a lista de responsáveis (pessoas do cadastro). Vazia = sem responsável. */
  const setTaskOwners = useCallback((taskId: string, ids: string[]) => {
    const s0 = load()
    const before = findTask(s0, taskId)
    if (!before) return
    const clean = [...new Set(ids.filter((id) => s0.people.some((p) => p.id === id)))]
    const prev = before.ownerIds ?? (before.ownerId ? [before.ownerId] : [])
    if (clean.length === prev.length && clean.every((id, i) => id === prev[i])) return
    const added = clean.filter((id) => !prev.includes(id))
    const to = ownerText(clean, s0.people)
    apply((s) => updateTask(s, taskId, (t) => withOwners(t, clean, s.people)), {
      entityType: 'task',
      entityId: taskId,
      entityLabel: before.label,
      action: 'task.owner',
      details: { to, ownerId: clean[0] ?? null, ownerIds: clean, added, due: before.due },
    })
  }, [])

  const addTask = useCallback((areaId: string, label: string): string => {
    const id = newId('t')
    const clean = label.trim()
    if (!clean) return ''
    apply(
      (s) =>
        updateArea(s, areaId, (a) => ({
          ...a,
          tasks: [...a.tasks, { id, label: clean, done: false, owner: '', due: '', custom: true }],
        })),
      {
        action: 'task.add',
        entityType: 'task',
        entityId: id,
        entityLabel: clean,
        details: { area: findArea(load(), areaId)?.name },
      },
    )
    return id
  }, [])

  const removeTask = useCallback((taskId: string) => {
    const t = findTask(load(), taskId)
    apply(
      (s) => ({
        ...s,
        phases: s.phases.map((p) => ({
          ...p,
          areas: p.areas.map((a) => ({ ...a, tasks: a.tasks.filter((x) => x.id !== taskId) })),
        })),
      }),
      { action: 'task.remove', entityType: 'task', entityId: taskId, entityLabel: t?.label },
    )
  }, [])

  /** Move a tarefa para outra área (de qualquer fase), no fim da lista de destino. */
  const moveTaskToArea = useCallback((taskId: string, targetAreaId: string) => {
    const s0 = load()
    const from = locateTask(s0, taskId)
    const target = findArea(s0, targetAreaId)
    const targetPhase = s0.phases.find((p) => p.areas.some((a) => a.id === targetAreaId))
    if (!from || !target || !targetPhase || from.area.id === targetAreaId) return
    const task = findTask(s0, taskId)
    apply(
      (s) => {
        const t = findTask(s, taskId)
        if (!t) return s
        return {
          ...s,
          phases: s.phases.map((p) => ({
            ...p,
            areas: p.areas.map((a) => {
              const without = a.tasks.filter((x) => x.id !== taskId)
              if (a.id === targetAreaId) return { ...a, tasks: [...without, t] }
              return without.length === a.tasks.length ? a : { ...a, tasks: without }
            }),
          })),
        }
      },
      {
        action: 'task.move',
        entityType: 'task',
        entityId: taskId,
        entityLabel: task?.label,
        details: {
          from: `${from.phase.name} › ${from.area.name}`,
          to: `${targetPhase.name} › ${target.name}`,
        },
      },
    )
  }, [])

  const moveTask = useCallback((taskId: string, direction: -1 | 1) => {
    apply((s) => ({
      ...s,
      phases: s.phases.map((p) => ({
        ...p,
        areas: p.areas.map((a) => {
          const i = a.tasks.findIndex((t) => t.id === taskId)
          const j = i + direction
          if (i < 0 || j < 0 || j >= a.tasks.length) return a
          const tasks = [...a.tasks]
          ;[tasks[i], tasks[j]] = [tasks[j], tasks[i]]
          return { ...a, tasks }
        }),
      })),
    }))
  }, [])

  /**
   * Arrastar e soltar: coloca a tarefa na área `targetAreaId` (a mesma ou outra, de qualquer fase),
   * antes da tarefa `beforeTaskId`; sem `beforeTaskId`, vai para o fim. Mudar de área entra no histórico.
   */
  const placeTask = useCallback(
    (taskId: string, targetAreaId: string, beforeTaskId: string | null) => {
      const s0 = load()
      const from = locateTask(s0, taskId)
      const target = findArea(s0, targetAreaId)
      const targetPhase = s0.phases.find((p) => p.areas.some((a) => a.id === targetAreaId))
      if (!from || !target || !targetPhase || beforeTaskId === taskId) return
      const sameArea = from.area.id === targetAreaId
      const reduce: Reducer = (s) => {
        const t = findTask(s, taskId)
        if (!t) return s
        let changed = false
        const phases = s.phases.map((p) => ({
          ...p,
          areas: p.areas.map((a) => {
            const without = a.tasks.filter((x) => x.id !== taskId)
            if (a.id !== targetAreaId)
              return without.length === a.tasks.length ? a : { ...a, tasks: without }
            const at = beforeTaskId ? without.findIndex((x) => x.id === beforeTaskId) : -1
            const tasks = [...without]
            tasks.splice(at === -1 ? tasks.length : at, 0, t)
            if (tasks.length === a.tasks.length && tasks.every((x, i) => x === a.tasks[i])) return a
            changed = true
            return { ...a, tasks }
          }),
        }))
        return changed || !sameArea ? { ...s, phases } : s
      }
      apply(
        reduce,
        sameArea
          ? undefined
          : {
              action: 'task.move',
              entityType: 'task',
              entityId: taskId,
              entityLabel: findTask(s0, taskId)?.label,
              details: {
                from: `${from.phase.name} › ${from.area.name}`,
                to: `${targetPhase.name} › ${target.name}`,
              },
            },
      )
    },
    [],
  )

  const setAreaDone = useCallback((areaId: string, done: boolean) => {
    const a = findArea(load(), areaId)
    apply(
      (s) => updateArea(s, areaId, (x) => ({ ...x, tasks: x.tasks.map((t) => ({ ...t, done })) })),
      {
        action: done ? 'area.done_all' : 'area.undone_all',
        entityType: 'area',
        entityId: areaId,
        entityLabel: a?.name,
      },
    )
  }, [])

  const addArea = useCallback((phaseId: string, name: string): string => {
    const clean = name.trim().toUpperCase()
    if (!clean) return ''
    const id = newId('a')
    apply(
      (s) =>
        updatePhase(s, phaseId, (p) => ({
          ...p,
          areas: [...p.areas, { id, name: clean, tasks: [] }],
        })),
      {
        action: 'area.add',
        entityType: 'area',
        entityId: id,
        entityLabel: clean,
      },
    )
    return id
  }, [])

  const renameArea = useCallback((areaId: string, name: string) => {
    const clean = name.trim().toUpperCase()
    if (!clean) return
    const before = findArea(load(), areaId)?.name
    apply((s) => updateArea(s, areaId, (a) => ({ ...a, name: clean })), {
      action: 'area.rename',
      entityType: 'area',
      entityId: areaId,
      entityLabel: clean,
      details: { from: before },
    })
  }, [])

  const removeArea = useCallback((areaId: string) => {
    const a = findArea(load(), areaId)
    apply(
      (s) => ({
        ...s,
        phases: s.phases.map((p) => ({ ...p, areas: p.areas.filter((x) => x.id !== areaId) })),
      }),
      {
        action: 'area.remove',
        entityType: 'area',
        entityId: areaId,
        entityLabel: a?.name,
        details: { tasks: a?.tasks.length },
      },
    )
  }, [])

  /** Cria fase no fim da lista. A partir daqui o modelo para de reinserir fase sozinho. */
  const addPhase = useCallback(
    (name: string, dates?: { start?: IsoDate; end?: IsoDate }): string => {
      const clean = name.trim().slice(0, 60)
      if (!clean) return ''
      const id = newId('f')
      const start = dates?.start && isValidIso(dates.start) ? dates.start : ''
      const end = dates?.end && isValidIso(dates.end) ? dates.end : ''
      apply(
        (s) => ({
          ...s,
          phasesCustom: true,
          phases: [...s.phases, { id, name: clean, start, end, areas: [] }],
        }),
        { action: 'phase.add', entityType: 'phase', entityId: id, entityLabel: clean },
      )
      return id
    },
    [],
  )

  /** Apaga a fase com tudo que está dentro dela (áreas e tarefas). */
  const removePhase = useCallback((phaseId: string) => {
    const p = load().phases.find((x) => x.id === phaseId)
    if (!p) return
    const tasks = p.areas.reduce((n, a) => n + a.tasks.length, 0)
    apply(
      (s) =>
        s.phases.length <= 1
          ? s
          : {
              ...s,
              phasesCustom: true,
              phases: s.phases.filter((x) => x.id !== phaseId),
              diary: Object.fromEntries(
                Object.entries(s.diary).filter(([k]) => !k.startsWith(`${phaseId}:`)),
              ),
            },
      {
        action: 'phase.remove',
        entityType: 'phase',
        entityId: phaseId,
        entityLabel: p.name,
        details: { areas: p.areas.length, tasks },
      },
    )
  }, [])

  /** Troca a fase de lugar com a vizinha. */
  const movePhase = useCallback((phaseId: string, dir: 'up' | 'down') => {
    const p = load().phases.find((x) => x.id === phaseId)
    if (!p) return
    apply(
      (s) => {
        const i = s.phases.findIndex((x) => x.id === phaseId)
        const j = dir === 'up' ? i - 1 : i + 1
        if (i === -1 || j < 0 || j >= s.phases.length) return s
        const phases = [...s.phases]
        ;[phases[i], phases[j]] = [phases[j], phases[i]]
        return { ...s, phasesCustom: true, phases }
      },
      {
        action: 'phase.move',
        entityType: 'phase',
        entityId: phaseId,
        entityLabel: p.name,
        details: { dir },
      },
    )
  }, [])

  const patchPhase = useCallback(
    (phaseId: string, patch: Partial<Pick<Phase, 'name' | 'start' | 'end'>>) => {
      // Data vazia é fase sem cronograma; só data escrita pela metade é ignorada.
      if (patch.start !== undefined && patch.start !== '' && !isValidIso(patch.start)) return
      if (patch.end !== undefined && patch.end !== '' && !isValidIso(patch.end)) return
      const p = load().phases.find((x) => x.id === phaseId)
      apply((s) => updatePhase(s, phaseId, (x) => ({ ...x, ...patch })), {
        action: 'phase.update',
        entityType: 'phase',
        entityId: phaseId,
        entityLabel: patch.name ?? p?.name,
        details: patch,
      })
    },
    [],
  )

  const patchMilestone = useCallback((id: string, patch: Partial<Omit<Milestone, 'id'>>) => {
    if (patch.date !== undefined && !isValidIso(patch.date)) return
    const m = load().milestones.find((x) => x.id === id)
    apply(
      (s) => ({
        ...s,
        milestones: s.milestones.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      }),
      {
        action: 'milestone.update',
        entityType: 'milestone',
        entityId: id,
        entityLabel: patch.label ?? m?.label,
        details: patch,
      },
    )
  }, [])

  const addMilestone = useCallback((label: string, date: string) => {
    const id = newId('m')
    apply((s) => ({ ...s, milestones: [...s.milestones, { id, label, date }] }), {
      action: 'milestone.add',
      entityType: 'milestone',
      entityId: id,
      entityLabel: label,
      details: { date },
    })
  }, [])

  const removeMilestone = useCallback((id: string) => {
    const m = load().milestones.find((x) => x.id === id)
    apply((s) => ({ ...s, milestones: s.milestones.filter((x) => x.id !== id) }), {
      action: 'milestone.remove',
      entityType: 'milestone',
      entityId: id,
      entityLabel: m?.label,
    })
  }, [])

  const addMeeting = useCallback((input: Omit<Meeting, 'id'>): string => {
    const clean = normalizeMeeting(input)
    if (!clean) return ''
    const id = newId('r')
    apply((s) => ({ ...s, meetings: [...s.meetings, { id, ...clean }] }), {
      action: 'meeting.add',
      entityType: 'meeting',
      entityId: id,
      entityLabel: clean.title,
      details: {
        date: clean.date,
        time: clean.time,
        link: clean.link,
        attendeeIds: clean.attendeeIds ?? [],
      },
    })
    return id
  }, [])

  const patchMeeting = useCallback((id: string, patch: Partial<Omit<Meeting, 'id'>>) => {
    const cur = load().meetings.find((m) => m.id === id)
    if (!cur) return
    const clean = normalizeMeeting({ ...cur, ...patch })
    if (!clean) return
    apply(
      (s) => ({ ...s, meetings: s.meetings.map((m) => (m.id === id ? { id, ...clean } : m)) }),
      {
        action: 'meeting.update',
        entityType: 'meeting',
        entityId: id,
        entityLabel: clean.title,
        details: { date: clean.date, time: clean.time },
      },
    )
  }, [])

  const removeMeeting = useCallback((id: string) => {
    const m = load().meetings.find((x) => x.id === id)
    apply((s) => ({ ...s, meetings: s.meetings.filter((x) => x.id !== id) }), {
      action: 'meeting.remove',
      entityType: 'meeting',
      entityId: id,
      entityLabel: m?.title,
    })
  }, [])

  const toggleTaskLabel = useCallback((taskId: string, labelId: string) => {
    const s0 = load()
    const t = findTask(s0, taskId)
    const l = s0.labels.find((x) => x.id === labelId)
    const on = !t?.labelIds?.includes(labelId)
    apply(
      (s) =>
        updateTask(s, taskId, (x) => {
          const cur = x.labelIds ?? []
          const next = cur.includes(labelId) ? cur.filter((y) => y !== labelId) : [...cur, labelId]
          return { ...x, labelIds: next }
        }),
      {
        action: on ? 'task.label_on' : 'task.label_off',
        entityType: 'task',
        entityId: taskId,
        entityLabel: t?.label,
        details: { label: l?.name },
      },
    )
  }, [])

  const addLabel = useCallback((name: string, color: Label['color']): string => {
    const clean = name.trim()
    if (!clean) return ''
    const id = newId('l')
    apply((s) => ({ ...s, labels: [...s.labels, { id, name: clean, color }] }), {
      action: 'label.add',
      entityType: 'label',
      entityId: id,
      entityLabel: clean,
      details: { color },
    })
    return id
  }, [])

  const patchLabel = useCallback((labelId: string, patch: Partial<Omit<Label, 'id'>>) => {
    if (patch.name !== undefined && !patch.name.trim()) return
    const l = load().labels.find((x) => x.id === labelId)
    apply(
      (s) => ({ ...s, labels: s.labels.map((x) => (x.id === labelId ? { ...x, ...patch } : x)) }),
      {
        action: 'label.update',
        entityType: 'label',
        entityId: labelId,
        entityLabel: patch.name ?? l?.name,
        details: patch,
      },
    )
  }, [])

  /** Remove a etiqueta e a tira de todas as tarefas. */
  const removeLabel = useCallback((labelId: string) => {
    const l = load().labels.find((x) => x.id === labelId)
    apply(
      (s) => ({
        ...s,
        labels: s.labels.filter((x) => x.id !== labelId),
        phases: s.phases.map((p) => ({
          ...p,
          areas: p.areas.map((a) => ({
            ...a,
            tasks: a.tasks.map((t) =>
              t.labelIds?.includes(labelId)
                ? { ...t, labelIds: t.labelIds.filter((x) => x !== labelId) }
                : t,
            ),
          })),
        })),
        ...(s.content
          ? {
              content: {
                ...s.content,
                cards: s.content.cards.map((k) =>
                  k.labelIds.includes(labelId)
                    ? { ...k, labelIds: k.labelIds.filter((x) => x !== labelId) }
                    : k,
                ),
              },
            }
          : {}),
      }),
      { action: 'label.remove', entityType: 'label', entityId: labelId, entityLabel: l?.name },
    )
  }, [])

  const taskEvent = (
    taskId: string,
    action: ActivityInput['action'],
    details?: Record<string, unknown>,
  ): ActivityInput => ({
    action,
    entityType: 'task',
    entityId: taskId,
    entityLabel: findTask(load(), taskId)?.label,
    details,
  })

  const addChecklist = useCallback((taskId: string, title: string): string => {
    const id = newId('c')
    const clean = title.trim() || 'Checklist'
    apply(
      (s) =>
        updateTask(s, taskId, (t) => ({
          ...t,
          checklists: [...(t.checklists ?? []), { id, title: clean, items: [] }],
        })),
      taskEvent(taskId, 'checklist.add', { title: clean }),
    )
    return id
  }, [])

  const patchChecklist = useCallback(
    (taskId: string, checklistId: string, patch: Partial<Pick<TaskChecklist, 'title'>>) => {
      apply(
        (s) =>
          updateTask(s, taskId, (t) => ({
            ...t,
            checklists: (t.checklists ?? []).map((c) =>
              c.id === checklistId ? { ...c, ...patch } : c,
            ),
          })),
        taskEvent(taskId, 'checklist.rename', { title: patch.title }),
      )
    },
    [],
  )

  const removeChecklist = useCallback((taskId: string, checklistId: string) => {
    const title = findTask(load(), taskId)?.checklists?.find((c) => c.id === checklistId)?.title
    apply(
      (s) =>
        updateTask(s, taskId, (t) => {
          const rest = (t.checklists ?? []).filter((c) => c.id !== checklistId)
          return { ...t, checklists: rest.length ? rest : undefined }
        }),
      taskEvent(taskId, 'checklist.remove', { title }),
    )
  }, [])

  const addChecklistItem = useCallback(
    (taskId: string, checklistId: string, text: string): string => {
      const clean = text.trim()
      if (!clean) return ''
      const id = newId('i')
      apply(
        (s) =>
          updateTask(s, taskId, (t) => ({
            ...t,
            checklists: (t.checklists ?? []).map((c) =>
              c.id === checklistId
                ? { ...c, items: [...c.items, { id, text: clean, done: false }] }
                : c,
            ),
          })),
        taskEvent(taskId, 'checklist.item_add', { item: clean }),
      )
      return id
    },
    [],
  )

  const patchChecklistItem = useCallback(
    (
      taskId: string,
      checklistId: string,
      itemId: string,
      patch: Partial<Omit<ChecklistItem, 'id'>>,
    ) => {
      if (patch.text !== undefined && !patch.text.trim()) return
      const item = findTask(load(), taskId)
        ?.checklists?.find((c) => c.id === checklistId)
        ?.items.find((i) => i.id === itemId)
      const action: ActivityInput['action'] =
        patch.done !== undefined
          ? patch.done
            ? 'checklist.item_done'
            : 'checklist.item_undone'
          : 'checklist.item_rename'
      apply(
        (s) =>
          updateTask(s, taskId, (t) => ({
            ...t,
            checklists: (t.checklists ?? []).map((c) =>
              c.id === checklistId
                ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
                : c,
            ),
          })),
        taskEvent(taskId, action, { item: patch.text ?? item?.text }),
      )
    },
    [],
  )

  const removeChecklistItem = useCallback((taskId: string, checklistId: string, itemId: string) => {
    const item = findTask(load(), taskId)
      ?.checklists?.find((c) => c.id === checklistId)
      ?.items.find((i) => i.id === itemId)
    apply(
      (s) =>
        updateTask(s, taskId, (t) => ({
          ...t,
          checklists: (t.checklists ?? []).map((c) =>
            c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
          ),
        })),
      taskEvent(taskId, 'checklist.item_remove', { item: item?.text }),
    )
  }, [])

  const setNotificationPref = useCallback(
    (key: Exclude<keyof NotificationPrefs, 'overdueEveryDays' | 'overdueHour'>, value: boolean) => {
      apply((s) => ({ ...s, notifications: { ...s.notifications, [key]: value } }), {
        action: value ? 'notify.on' : 'notify.off',
        entityType: 'notify',
        entityId: key,
        entityLabel: NOTIFICATION_PREF_LABELS[key],
      })
    },
    [],
  )

  /** De quantos em quantos dias a cobrança de tarefa atrasada se repete. */
  const setOverdueEvery = useCallback((days: number) => {
    const every = normalizeOverdueEvery(days)
    apply((s) => ({ ...s, notifications: { ...s.notifications, overdueEveryDays: every } }), {
      action: 'notify.every',
      entityType: 'notify',
      entityId: 'overdueEveryDays',
      entityLabel: NOTIFICATION_PREF_LABELS.overdue,
      details: { days: every },
    })
  }, [])

  /** Hora em que a cobrança de tarefa atrasada sai (horário de Brasília). */
  const setOverdueHour = useCallback((hour: number) => {
    const h = normalizeOverdueHour(hour)
    apply((s) => ({ ...s, notifications: { ...s.notifications, overdueHour: h } }), {
      action: 'notify.time',
      entityType: 'notify',
      entityId: 'overdueHour',
      entityLabel: NOTIFICATION_PREF_LABELS.overdue,
      details: { hour: h },
    })
  }, [])

  /** Texto do aviso; string vazia ou igual ao padrão volta ao padrão. */
  const setMessageTemplate = useCallback((kind: MessageKind, text: string) => {
    const t = text.trim().slice(0, TEMPLATE_MAX_LENGTH)
    const custom = t && t !== defaultTemplate(kind, boardKind(load()) === 'content') ? t : undefined
    apply(
      (s) => {
        const cur = s.messages?.[kind]
        if (cur === custom) return s
        const { [kind]: _drop, ...rest } = s.messages ?? {}
        const messages = custom ? { ...rest, [kind]: custom } : rest
        return Object.keys(messages).length ? { ...s, messages } : { ...s, messages: undefined }
      },
      {
        action: 'notify.template',
        entityType: 'notify',
        entityId: kind,
        entityLabel: MESSAGE_KIND_INFO[kind].title,
        details: { restored: !custom },
      },
    )
  }, [])

  const addPerson = useCallback((input: Omit<Person, 'id'>): string => {
    const name = input.name.trim()
    if (!name) return ''
    const id = newId('p')
    const role = input.role?.trim().slice(0, 60)
    const person: Person = {
      id,
      name,
      email: input.email.trim().toLowerCase(),
      ...withPhones(input.phones ?? [input.phone]),
      ...(role ? { role } : {}),
      notify: input.notify,
      ...(input.admin ? { admin: true } : {}),
      ...(input.admin && input.finance ? { finance: true } : {}),
      ...(!input.admin && input.client ? { client: true } : {}),
    }
    apply((s) => ({ ...s, people: [...s.people, person] }), {
      action: 'person.add',
      entityType: 'person',
      entityId: id,
      entityLabel: name,
    })
    return id
  }, [])

  const patchPerson = useCallback((id: string, patch: Partial<Omit<Person, 'id'>>) => {
    if (patch.name !== undefined && !patch.name.trim()) return
    const clean: Partial<Omit<Person, 'id'>> = { ...patch }
    if (clean.name !== undefined) clean.name = clean.name.trim()
    if (clean.email !== undefined) clean.email = clean.email.trim().toLowerCase()
    if (clean.phones !== undefined) Object.assign(clean, withPhones(clean.phones))
    else if (clean.phone !== undefined) Object.assign(clean, withPhones([clean.phone]))
    if (clean.role !== undefined) clean.role = clean.role.trim().slice(0, 60)
    const cur = load().people.find((p) => p.id === id)
    const merge = (p: Person): Person => {
      const next = { ...p, ...clean }
      // financeiro é um papel dentro do admin: sem admin, não sobra financeiro solto
      if (!next.admin || !next.finance) delete next.finance
      // cliente só vê e aprova: nunca é admin ao mesmo tempo
      if (next.admin || !next.client) delete next.client
      if (!next.admin) delete next.admin
      if (!next.phones || next.phones.length < 2) delete next.phones
      return next
    }
    apply(
      (s) => ({
        ...s,
        people: s.people.map((p) => (p.id === id ? merge(p) : p)),
        // o nome do responsável nas tarefas acompanha o cadastro
        phases:
          clean.name !== undefined
            ? s.phases.map((ph) => ({
                ...ph,
                areas: ph.areas.map((a) => ({
                  ...a,
                  tasks: a.tasks.map((t) =>
                    t.ownerIds?.includes(id) || t.ownerId === id
                      ? withOwners(
                          t,
                          t.ownerIds ?? [id],
                          s.people.map((x) => (x.id === id ? merge(x) : x)),
                        )
                      : t,
                  ),
                })),
              }))
            : s.phases,
      }),
      {
        action: 'person.update',
        entityType: 'person',
        entityId: id,
        entityLabel: clean.name ?? cur?.name,
        details: clean,
      },
    )
  }, [])

  const removePerson = useCallback((id: string) => {
    const cur = load().people.find((p) => p.id === id)
    apply(
      (s) => ({
        ...s,
        people: s.people.filter((p) => p.id !== id),
        phases: s.phases.map((ph) => ({
          ...ph,
          areas: ph.areas.map((a) => ({
            ...a,
            tasks: a.tasks.map((t) => {
              const ids = t.ownerIds ?? (t.ownerId ? [t.ownerId] : [])
              if (!ids.includes(id)) return t
              const rest = ids.filter((x) => x !== id)
              // quem sai do cadastro continua no texto se era o único (o nome não some da tarefa)
              return rest.length
                ? withOwners(t, rest, s.people)
                : { ...t, ownerId: undefined, ownerIds: undefined }
            }),
          })),
        })),
        meetings: s.meetings.map((m) =>
          m.attendeeIds?.includes(id)
            ? { ...m, attendeeIds: m.attendeeIds.filter((x) => x !== id) }
            : m,
        ),
      }),
      { action: 'person.remove', entityType: 'person', entityId: id, entityLabel: cur?.name },
    )
  }, [])

  /** Move todas as datas (fases, marcos, prazos) preservando as distâncias relativas. */
  const shiftLaunchStart = useCallback((newStart: IsoDate) => {
    if (!isValidIso(newStart)) return
    const from = load().launchStart
    const delta = diffDays(from, newStart)
    if (delta === 0) return
    apply(
      (s) => {
        const d = diffDays(s.launchStart, newStart)
        if (d === 0) return s
        return {
          ...s,
          launchStart: newStart,
          phases: s.phases.map((p) => ({
            ...p,
            start: p.start ? shift(p.start, d) : '',
            end: p.end ? shift(p.end, d) : '',
            areas: p.areas.map((a) => ({
              ...a,
              tasks: a.tasks.map((t) => ({ ...t, due: t.due ? shift(t.due, d) : '' })),
            })),
          })),
          milestones: s.milestones.map((m) => ({ ...m, date: m.date ? shift(m.date, d) : '' })),
          meetings: s.meetings.map((m) => ({ ...m, date: m.date ? shift(m.date, d) : m.date })),
        }
      },
      {
        action: 'calendar.shift',
        entityType: 'launch',
        entityLabel: 'Calendário',
        details: { from, to: newStart, delta },
      },
    )
  }, [])

  const restoreDefaultDates = useCallback(() => {
    apply(
      (s) => {
        if (boardKind(s) !== 'launch') return s
        const dates = defaultPhaseDates(s.launchStart)
        return {
          ...s,
          phases: s.phases.map((p) => (dates[p.id] ? { ...p, ...dates[p.id] } : p)),
          milestones: templateMilestones('launch', s.launchStart),
        }
      },
      { action: 'calendar.restore', entityType: 'launch', entityLabel: 'Calendário' },
    )
  }, [])

  const importState = useCallback((raw: unknown) => {
    const next = parseState(raw)
    snapshotCurrent()
    apply(() => next, { action: 'data.import', entityType: 'launch', entityLabel: 'Backup' })
  }, [])

  const resetAll = useCallback(() => {
    snapshotCurrent()
    apply(() => buildInitialState(), {
      action: 'data.reset',
      entityType: 'launch',
      entityLabel: 'Tudo',
    })
  }, [])

  return {
    setBrief,
    setDiary,
    patchTask,
    setTaskOwners,
    toggleTaskLabel,
    addLabel,
    patchLabel,
    removeLabel,
    addChecklist,
    patchChecklist,
    removeChecklist,
    addChecklistItem,
    patchChecklistItem,
    removeChecklistItem,
    addTask,
    removeTask,
    moveTask,
    placeTask,
    moveTaskToArea,
    setAreaDone,
    addArea,
    renameArea,
    removeArea,
    addPhase,
    removePhase,
    movePhase,
    patchPhase,
    patchMilestone,
    addMilestone,
    removeMilestone,
    addMeeting,
    patchMeeting,
    removeMeeting,
    setNotificationPref,
    setOverdueEvery,
    setOverdueHour,
    setMessageTemplate,
    addPerson,
    patchPerson,
    removePerson,
    shiftLaunchStart,
    restoreDefaultDates,
    importState,
    resetAll,
  }
}

/** Valida uma reunião; devolve null se título ou data forem inválidos. */
function normalizeMeeting(m: Omit<Meeting, 'id'>): Omit<Meeting, 'id'> | null {
  const title = m.title.trim()
  if (!title || !isValidIso(m.date)) return null
  const link = m.link.trim()
  if (link && !isHttpUrl(link)) return null
  return {
    title,
    date: m.date,
    time: isValidTime(m.time) ? m.time : '',
    durationMin: m.durationMin > 0 && m.durationMin <= 24 * 60 ? Math.round(m.durationMin) : 60,
    link,
    agenda: m.agenda,
    ...(m.summary?.trim() ? { summary: m.summary.trim().slice(0, SUMMARY_MAX_LENGTH) } : {}),
    ...(m.attendeeIds?.length ? { attendeeIds: [...new Set(m.attendeeIds)] } : {}),
  }
}

/** Guarda o estado atual em PREVIOUS_KEY antes de uma operação que o substitui inteiro. */
function snapshotCurrent() {
  try {
    window.localStorage.setItem(PREVIOUS_KEY, JSON.stringify(load()))
  } catch {
    // sem espaço para o snapshot: a operação segue, o usuário já confirmou no diálogo
  }
}

function shift(iso: string, delta: number): string {
  if (!isValidIso(iso)) return iso
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------- Seletores (puros, testáveis) ----------

export function allTasks(s: LaunchState): Task[] {
  return s.phases.flatMap((p) => p.areas.flatMap((a) => a.tasks))
}

export function progressOf(tasks: Task[]): { done: number; total: number; pct: number } {
  const total = tasks.length
  const done = tasks.filter((t) => t.done).length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** Modelo do quadro; estado antigo (sem o campo) é lançamento. */
export function boardKind(s: LaunchState): BoardKind {
  return s.kind ?? 'launch'
}

/** Nome do quadro para a interface e para os avisos. */
export function boardName(s: LaunchState): string {
  return s.name?.trim() || APP_NAME
}

export function currentPhase(s: LaunchState, today: IsoDate): Phase | undefined {
  const dated = s.phases.filter(phaseHasDates)
  return (
    dated.find((p) => p.start <= today && today <= p.end) ??
    dated.find((p) => p.start > today) ??
    dated.at(-1) ??
    s.phases[0]
  )
}

export function nextMilestone(s: LaunchState, today: IsoDate): Milestone | undefined {
  return [...s.milestones]
    .filter((m) => isValidIso(m.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((m) => m.date >= today)
}

export function overdueTasks(s: LaunchState, today: IsoDate): Task[] {
  return allTasks(s).filter((t) => !t.done && t.due && t.due < today)
}

/** Nomes já usados como responsável + nomes do time no brief (para autocomplete). */
export function knownOwners(s: LaunchState, teamFieldIds: string[]): string[] {
  const set = new Set<string>()
  for (const id of teamFieldIds) {
    const v = s.brief[id]?.trim()
    if (v) set.add(v)
  }
  for (const t of allTasks(s)) if (t.owner.trim()) set.add(t.owner.trim())
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Progresso somado de todas as checklists de um card. */
export function checklistProgress(task: Task): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const c of task.checklists ?? [])
    for (const i of c.items) {
      total += 1
      if (i.done) done += 1
    }
  return { done, total }
}

/** Fase e área onde a tarefa está. */
export function locateTask(
  s: LaunchState,
  taskId: string,
): { phase: Phase; area: Area } | undefined {
  for (const phase of s.phases)
    for (const area of phase.areas)
      if (area.tasks.some((t) => t.id === taskId)) return { phase, area }
  return undefined
}

export function findTask(s: LaunchState, taskId: string): Task | undefined {
  for (const p of s.phases)
    for (const a of p.areas) for (const t of a.tasks) if (t.id === taskId) return t
  return undefined
}

/** Reuniões de hoje em diante, ordenadas por data e hora. */
export function upcomingMeetings(s: LaunchState, today: IsoDate): Meeting[] {
  return [...s.meetings]
    .filter((m) => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

export function exportJson(s: LaunchState): string {
  return JSON.stringify(s, null, 2)
}
