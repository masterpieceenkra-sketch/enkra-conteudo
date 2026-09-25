import { ACTION_LABELS, detailText } from '../store/activity'
import { useActivity } from '../store/useActivity'

/** Últimas ações de um card, com quem fez e quando. */
export function TaskActivity({ taskId }: { taskId: string }) {
  const { items, enabled, loading } = useActivity({ entityId: taskId, limit: 5 })
  if (!enabled) return null
  if (loading || items.length === 0) return null
  const last = items[0]
  const when = new Date(last.at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <section>
      <h3 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Última ação
      </h3>
      <p className="mt-2 text-sm">
        <strong>{last.actor || 'Sem nome'}</strong> {ACTION_LABELS[last.action]} este card
        {detailText(last) ? (
          <span className="text-muted-foreground"> {detailText(last)}</span>
        ) : null}
        <span className="text-muted-foreground"> · {when}</span>
      </p>
      {items.length > 1 ? (
        <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
          {items.slice(1).map((it) => (
            <li key={it.id}>
              {new Date(it.at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {it.actor || 'Sem nome'} {ACTION_LABELS[it.action]}
              {detailText(it) ? ` ${detailText(it)}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
