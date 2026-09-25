import { useMe } from '../components/useActor'
import { SYNC_ENABLED } from '../lib/supabase'

/** Cliente do hub de conteúdo: vê, comenta e aprova, mas não edita o quadro. */
export function useIsClient(): boolean {
  const me = useMe()
  return SYNC_ENABLED && me?.client === true
}
