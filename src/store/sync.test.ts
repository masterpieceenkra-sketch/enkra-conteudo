import { describe, expect, it, vi } from 'vitest'
import type { LaunchState } from '../data/types'
import { buildInitialState, parseState } from './launchStore'
import { SyncEngine, type SyncTransport } from './sync'

/** Servidor falso em memória com controle de versão igual ao da RPC. */
function fakeServer(initial: LaunchState | null) {
  let row: { state: LaunchState; version: number } | null = initial
    ? { state: initial, version: 1 }
    : null
  const events: unknown[] = []
  const listeners = new Set<() => void>()
  const transport: SyncTransport = {
    fetch: vi.fn(async () =>
      row ? { state: JSON.parse(JSON.stringify(row.state)), version: row.version } : null,
    ),
    commit: vi.fn(async (_id, state, expected, _actor, evs) => {
      if (!row) {
        row = { state: JSON.parse(JSON.stringify(state)), version: 1 }
        events.push(...evs)
        return { ok: true as const, version: 1 }
      }
      if (row.version !== expected)
        return {
          ok: false as const,
          version: row.version,
          state: JSON.parse(JSON.stringify(row.state)),
        }
      row = { state: JSON.parse(JSON.stringify(state)), version: row.version + 1 }
      events.push(...evs)
      listeners.forEach((l) => l())
      return { ok: true as const, version: row.version }
    }),
    subscribe: vi.fn((_id, onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    }),
  }
  return {
    transport,
    events,
    get row() {
      return row
    },
    set(state: LaunchState) {
      row = { state, version: (row?.version ?? 0) + 1 }
      listeners.forEach((l) => l())
    },
  }
}

function client(transport: SyncTransport | null, local: LaunchState) {
  let state = local
  const engine = new SyncEngine(transport, 'comu', {
    getLocal: () => state,
    parse: parseState,
    actor: () => ({ name: 'Wes', email: 'wes@enkra.com' }),
    setFromServer: (server, pending) => {
      let s = server
      for (const r of pending) s = r(s)
      state = s
    },
  })
  const act = (
    reduce: (s: LaunchState) => LaunchState,
    event?: Parameters<SyncEngine['enqueue']>[1],
  ) => {
    state = reduce(state)
    engine.enqueue(reduce, event)
  }
  return {
    engine,
    act,
    get state() {
      return state
    },
  }
}

const setBrief = (id: string, v: string) => (s: LaunchState) => ({
  ...s,
  brief: { ...s.brief, [id]: v },
})

describe('SyncEngine', () => {
  it('sem transporte fica em modo local e não faz nada', async () => {
    const c = client(null, buildInitialState())
    expect(c.engine.status).toBe('local')
    await c.engine.start()
    c.act(setBrief('a', '1'))
    await c.engine.flush()
    expect(c.engine.pendingCount).toBe(0)
  })

  it('não cria quadro a partir do cache local: quadro sem linha vira "não encontrado"', async () => {
    const srv = fakeServer(null)
    const c = client(srv.transport, buildInitialState())
    await c.engine.start()
    expect(srv.row).toBeNull()
    expect(c.engine.status).toBe('offline')
    expect(c.engine.lastErrorCode).toBe('not-found')
  })

  it('recusa de acesso na gravação vira código no-access', async () => {
    const seed = buildInitialState()
    const srv = fakeServer(seed)
    const c = client(srv.transport, buildInitialState())
    await c.engine.start()
    srv.transport.commit = () =>
      Promise.reject(new Error('sem acesso: seu número não está no cadastro deste lançamento'))
    c.act(setBrief('a', '1'))
    await c.engine.flush()
    expect(c.engine.status).toBe('offline')
    expect(c.engine.lastErrorCode).toBe('no-access')
  })

  it('carrega o estado do servidor e envia ações com eventos', async () => {
    const seed = buildInitialState()
    seed.brief.especialista = 'Do servidor'
    const srv = fakeServer(seed)
    const c = client(srv.transport, buildInitialState())
    await c.engine.start()
    expect(c.state.brief.especialista).toBe('Do servidor')
    c.act(setBrief('nomeEvento', 'Comu Academy'), { action: 'brief.set', entityId: 'nomeEvento' })
    c.act(setBrief('nomeEvento', 'Comu Academy 2'), { action: 'brief.set', entityId: 'nomeEvento' })
    await c.engine.flush()
    expect(srv.row?.state.brief.nomeEvento).toBe('Comu Academy 2')
    expect(srv.row?.version).toBe(2)
    // digitação contínua: os dois eventos iguais viraram um só
    expect(srv.events).toHaveLength(1)
    expect(c.engine.status).toBe('synced')
  })

  it('em conflito, reaplica as ações pendentes sobre o estado do outro e ninguém perde nada', async () => {
    const srv = fakeServer(buildInitialState())
    const a = client(srv.transport, buildInitialState())
    const b = client(srv.transport, buildInitialState())
    await a.engine.start()
    await b.engine.start()
    // A e B editam campos diferentes ao mesmo tempo
    a.act(setBrief('especialista', 'Gimena'))
    b.act(setBrief('nomeEvento', 'Comu Academy'))
    await a.engine.flush() // A grava a versão 2
    await b.engine.flush() // B tenta com a versão 1, recebe conflito, reaplica e grava a versão 3
    expect(srv.row?.version).toBe(3)
    expect(srv.row?.state.brief).toEqual({ especialista: 'Gimena', nomeEvento: 'Comu Academy' })
    expect(b.state.brief).toEqual({ especialista: 'Gimena', nomeEvento: 'Comu Academy' })
    // A recebe a mudança de B pelo realtime
    await a.engine.refresh()
    expect(a.state.brief.nomeEvento).toBe('Comu Academy')
  })

  it('refresh preserva o que ainda está pendente localmente', async () => {
    const srv = fakeServer(buildInitialState())
    const c = client(srv.transport, buildInitialState())
    await c.engine.start()
    c.act(setBrief('especialista', 'local ainda não enviado'))
    const other = buildInitialState()
    other.brief.nomeEvento = 'de outra pessoa'
    srv.set(other)
    await c.engine.refresh()
    expect(c.state.brief).toEqual({
      nomeEvento: 'de outra pessoa',
      especialista: 'local ainda não enviado',
    })
    await c.engine.flush()
    expect(srv.row?.state.brief).toEqual({
      nomeEvento: 'de outra pessoa',
      especialista: 'local ainda não enviado',
    })
  })

  it('falha de rede vira offline e mantém a fila', async () => {
    const srv = fakeServer(buildInitialState())
    const c = client(srv.transport, buildInitialState())
    await c.engine.start()
    ;(srv.transport.commit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('rede caiu'),
    )
    c.act(setBrief('especialista', 'x'))
    await c.engine.flush()
    expect(c.engine.status).toBe('offline')
    expect(c.engine.pendingCount).toBe(1)
    await c.engine.flush()
    expect(c.engine.status).toBe('synced')
    expect(srv.row?.state.brief.especialista).toBe('x')
    c.engine.stop()
  })
})
