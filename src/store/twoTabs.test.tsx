import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchState } from '../data/types'
import {
  __flushForTests,
  __resetStoreForTests,
  STORAGE_KEY,
  findTask,
  startSync,
  useLaunchActions,
  useLaunchState,
} from './launchStore'
import type { SyncTransport } from './sync'

/** Transporte falso: servidor em memória; devolve o último estado gravado. */
function fakeTransport(initial: LaunchState) {
  let row = { state: initial, version: 1 }
  const transport: SyncTransport = {
    fetch: vi.fn(async () => ({
      state: JSON.parse(JSON.stringify(row.state)),
      version: row.version,
    })),
    commit: vi.fn(async (_id, state, expected) => {
      if (row.version !== expected)
        return {
          ok: false as const,
          version: row.version,
          state: JSON.parse(JSON.stringify(row.state)),
        }
      row = { state: JSON.parse(JSON.stringify(state)), version: row.version + 1 }
      return { ok: true as const, version: row.version }
    }),
    subscribe: vi.fn(() => () => {}),
  }
  return {
    transport,
    get row() {
      return row
    },
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})
afterEach(() => __resetStoreForTests())

describe('duas abas do mesmo navegador', () => {
  it('a gravação de outra aba no cache local não apaga a descrição que está sendo digitada', async () => {
    const { result } = renderHook(() => ({ s: useLaunchState(), a: useLaunchActions() }))
    const server = fakeTransport(result.current.s)
    const engine = startSync(server.transport, 'comu', () => ({ name: 'Wes', email: '' }))
    await act(async () => {
      await tick()
      await tick()
    })
    const taskId = result.current.s.phases[1].areas[0].tasks[0].id
    // A outra aba gravou no localStorage um estado ANTERIOR à digitação (sem a descrição).
    const stale = JSON.stringify(result.current.s)

    act(() => result.current.a.patchTask(taskId, { description: 'press kit mensal' }))
    __flushForTests()
    localStorage.setItem(STORAGE_KEY, stale)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: stale }))
    })
    await act(async () => {
      await tick()
      await tick()
    })
    expect(findTask(result.current.s, taskId)?.description).toBe('press kit mensal')

    await act(async () => {
      await engine.flush()
    })
    expect(findTask(server.row.state, taskId)?.description).toBe('press kit mensal')
  })
})
