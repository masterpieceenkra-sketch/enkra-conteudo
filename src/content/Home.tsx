import { Navigate } from 'react-router'
import { PageSkeleton } from '../components/PageSkeleton'
import { useSyncStatus } from '../components/useSyncStatus'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { useIsClient } from './roles'

/** Entrada do app de conteúdo: o cliente cai na fila de aprovação; o time, no Analytics. */
export function ContentHome() {
  const client = useIsClient()
  const sync = useSyncStatus()
  // o papel vem do cadastro do servidor: antes dele chegar não dá para saber para onde ir
  if (sync.status === 'connecting') return <PageSkeleton />
  return client ? <Navigate to="/aprovar" replace /> : <AnalyticsPage />
}
