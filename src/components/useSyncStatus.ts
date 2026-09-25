import { useSyncExternalStore } from 'react'
import { getSync } from '../store/launchStore'
import type { SyncErrorCode, SyncStatus } from '../store/sync'

function subscribe(l: () => void) {
  return getSync()?.onStatus(l) ?? (() => {})
}

export function useSyncStatus(): {
  status: SyncStatus
  error: string | null
  pending: number
  code: SyncErrorCode
} {
  return useSyncExternalStore(
    subscribe,
    () => {
      const s = getSync()
      return s
        ? snapshot(s.status, s.lastError, s.pendingCount, s.lastErrorCode)
        : snapshot('local', null, 0, null)
    },
    () => snapshot('local', null, 0, null),
  )
}

// snapshot memoizado por valor, para o useSyncExternalStore não re-renderizar à toa
let last: {
  status: SyncStatus
  error: string | null
  pending: number
  code: SyncErrorCode
} = {
  status: 'local',
  error: null,
  pending: 0,
  code: null,
}
function snapshot(status: SyncStatus, error: string | null, pending: number, code: SyncErrorCode) {
  if (
    last.status !== status ||
    last.error !== error ||
    last.pending !== pending ||
    last.code !== code
  )
    last = { status, error, pending, code }
  return last
}
