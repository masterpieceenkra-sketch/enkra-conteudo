import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useSaveStatus } from '../store/launchStore'
import { useSyncStatus } from './useSyncStatus'

/** Estado de gravação: no banco compartilhado quando há sincronização, senão no navegador. */
export function SaveIndicator() {
  const local = useSaveStatus()
  const { status, error } = useSyncStatus()

  if (status === 'local') {
    if (local === 'idle') return null
    if (local === 'error')
      return (
        <span
          role="status"
          className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-danger"
        >
          <CloudOff className="size-3.5" aria-hidden /> Não salvo
        </span>
      )
    return (
      <span
        role="status"
        className="fade-in mr-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
      >
        <Check className="size-3.5" aria-hidden /> Salvo
      </span>
    )
  }

  const map = {
    connecting: {
      icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
      text: 'Conectando',
      cls: 'text-muted-foreground',
    },
    syncing: {
      icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />,
      text: 'Sincronizando',
      cls: 'text-muted-foreground',
    },
    synced: {
      icon: <Cloud className="size-3.5" aria-hidden />,
      text: 'Sincronizado',
      cls: 'text-muted-foreground',
    },
    offline: {
      icon: <CloudOff className="size-3.5" aria-hidden />,
      text: 'Offline',
      cls: 'text-danger',
    },
    error: {
      icon: <CloudOff className="size-3.5" aria-hidden />,
      text: 'Erro',
      cls: 'text-danger',
    },
  } as const
  const m = map[status]
  return (
    <span
      role="status"
      className={`mr-1 inline-flex items-center gap-1 text-xs font-semibold ${m.cls}`}
      title={
        status === 'offline'
          ? `Sem conexão com o banco. Suas alterações ficam aqui e sobem ao reconectar.${error ? ` (${error})` : ''}`
          : 'Salvo no banco compartilhado'
      }
    >
      {m.icon} <span className="hidden sm:inline">{m.text}</span>
    </span>
  )
}
