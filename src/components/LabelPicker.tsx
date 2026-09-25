import { Check, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LABEL_COLOR_CLASS, LABEL_COLOR_NAMES } from '../data/labels'
import { LABEL_COLORS, type Label, type LabelColor, type Task } from '../data/types'
import { useLaunchActions } from '../store/launchStore'
import { useConfirm } from './confirmContext'

// ---------- Etiquetas ----------

interface PickerProps {
  task: Task
  labels: Label[]
  /** 'button' = botão com texto (dentro do card); 'icon' = só o ícone (na linha da tarefa) */
  variant?: 'button' | 'icon'
  /** alinha o popover à direita (para não estourar a tela quando o botão fica no canto) */
  align?: 'left' | 'right'
}

/** Seletor de etiquetas: aplica/remove no card, cria, renomeia, recolore e exclui etiquetas. */
export function LabelPicker({ task, labels, variant = 'button', align = 'left' }: PickerProps) {
  const { toggleTaskLabel, addLabel, patchLabel, removeLabel } = useLaunchActions()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<LabelColor>('pink')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {variant === 'icon' ? (
        <button
          type="button"
          className={`icon-btn ${task.labelIds?.length ? 'text-primary' : ''}`}
          aria-label={`Etiquetas de: ${task.label}`}
          aria-expanded={open}
          title="Etiquetas"
          onClick={() => setOpen((o) => !o)}
        >
          <Tag className="size-4" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost h-7 border-dashed px-2.5 py-0 text-xs"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Plus className="size-3.5" aria-hidden /> Etiqueta
        </button>
      )}
      {open ? (
        <div
          className={`fade-in absolute top-full z-30 mt-1 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
          onKeyDown={(e) => {
            // Escape fecha só o seletor; sem isso o <dialog> nativo fecharia o card inteiro.
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
            }
          }}
        >
          <ul className="grid gap-1">
            {labels.map((l) => {
              const on = task.labelIds?.includes(l.id) ?? false
              const isEditing = editing === l.id
              return (
                <li key={l.id} className="flex items-center gap-1.5">
                  {isEditing ? (
                    <form
                      className="flex flex-1 items-center gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        patchLabel(l.id, { name: editName })
                        setEditing(null)
                      }}
                    >
                      <input
                        autoFocus
                        className="field h-7 flex-1 py-0 text-xs"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Nome da etiqueta"
                      />
                      <ColorDots value={l.color} onChange={(c) => patchLabel(l.id, { color: c })} />
                      <button type="submit" className="icon-btn" aria-label="Salvar etiqueta">
                        <Check className="size-4" aria-hidden />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`flex h-8 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted ${on ? 'bg-muted' : ''}`}
                        aria-pressed={on}
                        onClick={() => toggleTaskLabel(task.id, l.id)}
                      >
                        <span
                          className={`size-3.5 shrink-0 rounded-sm ${LABEL_COLOR_CLASS[l.color]}`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        {on ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Editar etiqueta ${l.name}`}
                        onClick={() => {
                          setEditing(l.id)
                          setEditName(l.name)
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="icon-btn hover:text-danger"
                        aria-label={`Excluir etiqueta ${l.name}`}
                        onClick={() =>
                          confirm({
                            title: `Excluir a etiqueta ${l.name}?`,
                            description: 'Ela some de todos os cards que a usam.',
                            confirmLabel: 'Excluir',
                            danger: true,
                            onConfirm: () => removeLabel(l.id),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <form
            className="mt-2 grid gap-2 border-t border-border pt-2"
            onSubmit={(e) => {
              e.preventDefault()
              const id = addLabel(newName, newColor)
              if (id) {
                toggleTaskLabel(task.id, id)
                setNewName('')
              }
            }}
          >
            <input
              className="field h-8 py-0 text-xs"
              placeholder="Nova etiqueta"
              aria-label="Nome da nova etiqueta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              <ColorDots value={newColor} onChange={setNewColor} />
              <button
                type="submit"
                className="btn-secondary h-8 py-0 text-xs"
                disabled={!newName.trim()}
              >
                Criar e aplicar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function ColorDots({ value, onChange }: { value: LabelColor; onChange: (c: LabelColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex items-center gap-1">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={LABEL_COLOR_NAMES[c]}
          title={LABEL_COLOR_NAMES[c]}
          onClick={() => onChange(c)}
          className={`size-5 rounded-full ${LABEL_COLOR_CLASS[c]} ${value === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''}`}
        />
      ))}
    </div>
  )
}
