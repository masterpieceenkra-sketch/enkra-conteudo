import { columnOf, type ContentCard, type ContentState, type Network } from './model'

export type Scope = 'agenda' | 'tudo'

/** O que entra na grade: da rede escolhida, com data; por padrão só o que já está programado ou no ar. */
export function feedCards(c: ContentState, network: Network, scope: Scope): ContentCard[] {
  return c.cards
    .filter((k) => k.networks.includes(network) && k.publishAt && k.format !== 'stories')
    .filter((k) => {
      if (scope === 'tudo') return true
      const stage = columnOf(c, k)?.stage
      return stage === 'scheduled' || stage === 'published'
    })
    .sort(
      (a, b) =>
        b.publishAt.localeCompare(a.publishAt) ||
        (b.publishTime || '').localeCompare(a.publishTime || ''),
    )
}
