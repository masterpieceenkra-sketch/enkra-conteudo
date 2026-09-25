import type { LaunchState } from '../data/types'
import { activityKey, type ActivityInput } from './activity'

export type Reducer = (s: LaunchState) => LaunchState

/** Quem está gravando: nome para exibir e e-mail para identificar. */
export interface Actor {
  name: string
  email: string
}

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'error'

/**
 * Motivo de um `offline`, quando dá para saber:
 * - `not-found`: o quadro não existe ou a leitura foi barrada para este login.
 * - `no-access`: o servidor recusou a gravação porque o telefone não está no cadastro do quadro.
 */
export type SyncErrorCode = 'not-found' | 'no-access' | null

export interface CommitOk {
  ok: true
  version: number
}
export interface CommitConflict {
  ok: false
  version: number
  state: unknown
}

/** O que o motor precisa do servidor. Injetável: o Supabase em produção, um fake nos testes. */
export interface SyncTransport {
  fetch(launchId: string): Promise<{ state: unknown; version: number } | null>
  commit(
    launchId: string,
    state: LaunchState,
    expectedVersion: number,
    actor: Actor,
    events: ActivityInput[],
    opts?: { keepalive?: boolean },
  ): Promise<CommitOk | CommitConflict>
  /** Avisa quando outra pessoa gravou. Devolve a função que cancela. */
  subscribe(launchId: string, onChange: () => void): () => void
}

export interface SyncHooks {
  /** estado local atual (base + todos os redutores pendentes) */
  getLocal: () => LaunchState
  /** substitui o estado local por (servidor + redutores pendentes) */
  setFromServer: (server: LaunchState, pending: Reducer[]) => void
  parse: (raw: unknown) => LaunchState
  actor: () => Actor
}

const FLUSH_DELAY_MS = 400
const MAX_CONFLICT_RETRIES = 5

/**
 * Sincroniza um documento inteiro com controle de versão.
 * Cada ação local é um redutor puro; se o servidor mudou, os redutores pendentes são
 * reaplicados sobre o estado novo e o commit é tentado de novo. Ninguém perde o que fez.
 */
export class SyncEngine {
  status: SyncStatus
  private pending: { reduce: Reducer; event?: ActivityInput }[] = []
  private baseVersion = 0
  private inFlight = false
  private dirtyFromServer = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private backoffMs = 2000
  private listeners = new Set<() => void>()
  private unsubscribe: (() => void) | null = null
  lastError: string | null = null
  lastErrorCode: SyncErrorCode = null
  private transport: SyncTransport | null
  private launchId: string
  private hooks: SyncHooks

  constructor(transport: SyncTransport | null, launchId: string, hooks: SyncHooks) {
    this.transport = transport
    this.launchId = launchId
    this.hooks = hooks
    this.status = transport ? 'connecting' : 'local'
  }

  get enabled() {
    return this.transport !== null
  }

  get pendingCount() {
    return this.pending.length
  }

  onStatus(l: () => void) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  private setStatus(s: SyncStatus, err: string | null = null, code: SyncErrorCode = null) {
    this.status = s
    this.lastError = err
    this.lastErrorCode = code ?? (err && /sem acesso/i.test(err) ? 'no-access' : null)
    this.listeners.forEach((l) => l())
  }

  /** Busca o estado do servidor; se o lançamento não existe ainda, cria a partir do local. */
  async start(): Promise<void> {
    if (!this.transport) return
    try {
      const row = await this.transport.fetch(this.launchId)
      // Sem linha: ou o quadro não existe, ou a leitura foi barrada para este login. Nunca criar
      // a partir do que está neste navegador — seria semear um cliente com dados de outro.
      if (!row) {
        this.setStatus('offline', 'quadro não encontrado', 'not-found')
        return
      }
      this.baseVersion = row.version
      this.hooks.setFromServer(
        this.hooks.parse(row.state),
        this.pending.map((p) => p.reduce),
      )
      this.unsubscribe?.()
      this.unsubscribe = this.transport.subscribe(this.launchId, () => void this.refresh())
      this.setStatus(this.pending.length ? 'syncing' : 'synced')
      if (this.pending.length) this.schedule(0)
    } catch (e) {
      this.setStatus('offline', e instanceof Error ? e.message : String(e))
      this.scheduleRetry(() => void this.start())
    }
  }

  stop() {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.timer) clearTimeout(this.timer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
  }

  enqueue(reduce: Reducer, event?: ActivityInput) {
    if (!this.transport) return
    if (event) {
      // digitação contínua: mantém só a versão mais recente do mesmo evento na fila
      const key = activityKey(event)
      for (const p of this.pending) if (p.event && activityKey(p.event) === key) p.event = undefined
    }
    this.pending.push({ reduce, event })
    if (this.status === 'synced') this.setStatus('syncing')
    this.schedule(FLUSH_DELAY_MS)
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), ms)
  }

  private scheduleRetry(fn: () => void) {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(fn, this.backoffMs)
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000)
  }

  /** Envia tudo que está pendente. Em conflito, reaplica e tenta de novo. */
  async flush(opts: { keepalive?: boolean } = {}): Promise<void> {
    if (!this.transport || this.inFlight || this.pending.length === 0) return
    if (this.status === 'connecting') return // start() ainda não terminou
    this.inFlight = true
    try {
      for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
        const snapshot = this.pending.slice()
        const candidate = this.hooks.getLocal()
        const events = snapshot.map((p) => p.event).filter((e): e is ActivityInput => !!e)
        const res = await this.transport.commit(
          this.launchId,
          candidate,
          this.baseVersion,
          this.hooks.actor(),
          events,
          opts,
        )
        if (res.ok) {
          this.baseVersion = res.version
          this.pending = this.pending.slice(snapshot.length)
          this.backoffMs = 2000
          break
        }
        // conflito: alguém gravou antes. Reaplica os pendentes sobre o estado do servidor.
        this.baseVersion = res.version
        this.hooks.setFromServer(
          this.hooks.parse(res.state),
          this.pending.map((p) => p.reduce),
        )
      }
      this.setStatus(this.pending.length ? 'syncing' : 'synced')
      if (this.pending.length) this.schedule(FLUSH_DELAY_MS)
    } catch (e) {
      this.setStatus('offline', e instanceof Error ? e.message : String(e))
      this.scheduleRetry(() => void this.flush())
    } finally {
      this.inFlight = false
      if (this.dirtyFromServer) {
        this.dirtyFromServer = false
        void this.refresh()
      }
    }
  }

  /** Outra pessoa gravou: busca o estado novo e reaplica o que ainda está pendente aqui. */
  async refresh(): Promise<void> {
    if (!this.transport) return
    if (this.inFlight) {
      this.dirtyFromServer = true
      return
    }
    try {
      const row = await this.transport.fetch(this.launchId)
      if (!row || row.version <= this.baseVersion) return
      this.baseVersion = row.version
      this.hooks.setFromServer(
        this.hooks.parse(row.state),
        this.pending.map((p) => p.reduce),
      )
      if (this.status === 'offline' || this.status === 'error')
        this.setStatus(this.pending.length ? 'syncing' : 'synced')
    } catch (e) {
      this.setStatus('offline', e instanceof Error ? e.message : String(e))
    }
  }
}
