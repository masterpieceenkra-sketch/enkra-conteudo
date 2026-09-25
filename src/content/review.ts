import { LAUNCH_ID, supabase } from '../lib/supabase'
import { getSync } from '../store/launchStore'

export type ReviewDecision = 'aprovado' | 'ajuste' | 'comentario'

/**
 * Aprovar, pedir ajuste ou comentar pelo servidor (RPC `comu_hub_content_review`). É o único
 * caminho de escrita do cliente: o commit comum recusa quem é cliente. Aprovar leva o card
 * para a próxima coluna; pedir ajuste exige texto. Depois puxa a versão nova do quadro.
 */
export async function reviewCard(
  cardId: string,
  decision: ReviewDecision,
  text: string,
): Promise<void> {
  const sb = supabase()
  if (!sb) throw new Error('A aprovação precisa do servidor.')
  const { error } = await sb.rpc('comu_hub_content_review', {
    p_launch_id: LAUNCH_ID,
    p_card_id: cardId,
    p_decision: decision,
    p_text: text.trim(),
  })
  if (error) throw new Error(error.message)
  await getSync()?.refresh()
}

/** Manda para os clientes, num aviso só, a lista do que está esperando aprovação. */
export async function notifyPendingReview(): Promise<number> {
  const sb = supabase()
  if (!sb) throw new Error('O aviso precisa do servidor.')
  const { data, error } = await sb.rpc('comu_hub_content_notify_review', { p_launch_id: LAUNCH_ID })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : 0
}
