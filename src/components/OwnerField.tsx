import { X } from 'lucide-react'
import type { Person, Task } from '../data/types'

interface Props {
  task: Task
  people: Person[]
  onChange: (patch: Partial<Task>) => void
  /** lista de responsáveis do cadastro (vários); quando ausente, cai no campo de um só */
  onChangeOwners?: (ids: string[]) => void
  className?: string
  compact?: boolean
}

/**
 * Responsáveis da tarefa. Com pessoas cadastradas: chips com quem já está e um select para
 * somar mais um (cada um recebe os avisos no WhatsApp). Sem cadastro: texto livre com sugestões.
 */
export function OwnerField({
  task,
  people,
  onChange,
  onChangeOwners,
  className = '',
  compact,
}: Props) {
  const label = `Responsável por: ${task.label}`
  if (people.length === 0)
    return (
      <input
        list="owner-suggestions"
        placeholder="Responsável"
        aria-label={label}
        className={`field min-w-0 py-1.5 ${compact ? 'flex-1' : 'w-36'} ${className}`}
        value={task.owner}
        onChange={(e) => onChange({ owner: e.target.value, ownerId: undefined })}
      />
    )

  const ids = (task.ownerIds ?? (task.ownerId ? [task.ownerId] : [])).filter((id) =>
    people.some((p) => p.id === id),
  )
  const chosen = ids.map((id) => people.find((p) => p.id === id)!)
  const legacy = ids.length === 0 && task.owner.trim() !== ''
  const available = people.filter((p) => !ids.includes(p.id))
  const set = (next: string[]) => {
    if (onChangeOwners) onChangeOwners(next)
    else if (next.length === 0) onChange({ owner: '', ownerId: undefined })
    else {
      const p = people.find((x) => x.id === next[0])
      if (p) onChange({ owner: p.name, ownerId: p.id })
    }
  }

  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-1 ${compact ? 'flex-1' : ''} ${className}`}
      role="group"
      aria-label={label}
    >
      {chosen.map((p) => (
        <span
          key={p.id}
          className="inline-flex h-7 max-w-40 items-center gap-1 rounded-md bg-secondary pl-2 pr-1 text-xs font-semibold text-secondary-foreground"
        >
          <span className="truncate">{p.name}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-foreground/10"
            aria-label={`Remover ${p.name} de ${task.label}`}
            onClick={() => set(ids.filter((id) => id !== p.id))}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {legacy ? (
        <span
          className="inline-flex h-7 max-w-40 items-center gap-1 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground"
          title="Nome digitado antes do cadastro. Escolha alguém da lista para trocar."
        >
          <span className="truncate">{task.owner}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-foreground/10"
            aria-label={`Remover ${task.owner} de ${task.label}`}
            onClick={() => onChange({ owner: '', ownerId: undefined })}
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ) : null}
      {available.length ? (
        <select
          aria-label={ids.length ? `Adicionar responsável a ${task.label}` : label}
          className={`field h-7 min-w-0 py-0 text-xs ${ids.length ? 'w-8 text-center' : compact ? 'w-32' : 'w-36'}`}
          title={ids.length ? 'Adicionar responsável' : undefined}
          value=""
          onChange={(e) => {
            if (e.target.value) set([...ids, e.target.value])
          }}
        >
          <option value="">{ids.length ? '+' : 'Responsável'}</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
