import {
  AlignLeft,
  CheckSquare,
  ExternalLink,
  Link2,
  Plus,
  Send,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isHttpUrl } from '../data/labels'
import type { LaunchState, Person, Task, TaskChecklist } from '../data/types'
import { SYNC_ENABLED } from '../lib/supabase'
import {
  findTask,
  getSync,
  locateTask,
  useLaunchActions,
  useLaunchState,
} from '../store/launchStore'
import { sendTaskUpdate } from '../store/supabaseTransport'
import { AutoTextarea } from './AutoTextarea'
import { LabelChip } from './LabelChip'
import { LabelPicker } from './LabelPicker'
import { OwnerField } from './OwnerField'
import { ProgressBar } from './ProgressBar'
import { TaskActivity } from './TaskActivity'
import { useConfirm } from './confirmContext'
import { useToast } from './toastContext'
import { WhatsAppBadge } from './WhatsAppBadge'
import { useProfile } from './useActor'

interface Props {
  taskId: string | null
  onClose: () => void
}

/** Card no estilo Trello: título, etiquetas, link, descrição e checklists. */
export function TaskDetailDialog({ taskId, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const s = useLaunchState()
  const task = taskId ? findTask(s, taskId) : undefined

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (taskId && !d.open) d.showModal()
    if (!taskId && d.open) d.close()
  }, [taskId])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl"
    >
      {task ? <CardBody key={task.id} task={task} state={s} onClose={onClose} /> : null}
    </dialog>
  )
}

function CardBody({
  task,
  state,
  onClose,
}: {
  task: Task
  state: LaunchState
  onClose: () => void
}) {
  const { labels, people } = state
  const where = locateTask(state, task.id)
  const { patchTask, setTaskOwners, removeTask, moveTaskToArea, addArea } = useLaunchActions()
  const [newAreaName, setNewAreaName] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()
  const profile = useProfile()
  const [notifying, setNotifying] = useState(false)
  const owners = (task.ownerIds ?? (task.ownerId ? [task.ownerId] : []))
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p && p.phone !== '' && p.notify)
  const canNotify = SYNC_ENABLED && owners.length > 0
  const [title, setTitle] = useState(task.label)
  const [desc, setDesc] = useState(task.description ?? '')
  const [link, setLink] = useState(task.link ?? '')
  const linkInvalid = link.trim() !== '' && !isHttpUrl(link.trim())
  const taskLabels = labels.filter((l) => task.labelIds?.includes(l.id))

  function commitTitle() {
    const clean = title.trim()
    if (clean && clean !== task.label) patchTask(task.id, { label: clean })
    else setTitle(task.label)
  }
  function commitLink() {
    const clean = link.trim()
    if (clean === '' || isHttpUrl(clean)) patchTask(task.id, { link: clean })
  }

  return (
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <input
          type="checkbox"
          className="checkbox mt-1.5"
          checked={task.done}
          aria-label="Concluída"
          onChange={(e) => patchTask(task.id, { done: e.target.checked })}
        />
        <div className="min-w-0 flex-1">
          <input
            className={`w-full bg-transparent font-display text-xl font-bold leading-tight tracking-[-0.03em] outline-none focus:ring-2 focus:ring-primary/30 rounded-md sm:text-2xl ${
              task.done ? 'text-muted-foreground line-through' : ''
            }`}
            aria-label="Título do card"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Responsável
              <OwnerField
                task={task}
                people={people}
                className="text-xs"
                onChange={(patch) => patchTask(task.id, patch)}
                onChangeOwners={(ids) => setTaskOwners(task.id, ids)}
              />
            </span>
            <label className="flex items-center gap-1.5">
              Prazo
              <input
                type="date"
                className="field h-7 w-auto min-h-0 py-0 text-xs"
                value={task.due}
                onChange={(e) => patchTask(task.id, { due: e.target.value })}
              />
            </label>
            {where ? (
              <span className="flex items-center gap-1.5">
                Fase
                <select
                  className="field h-7 w-auto py-0 text-xs"
                  aria-label="Mover para a fase"
                  value={where.phase.id}
                  onChange={(e) => {
                    const phase = state.phases.find((p) => p.id === e.target.value)
                    if (!phase) return
                    if (!phase.areas.length) {
                      // fase sem áreas: cria uma com o nome da área atual e leva o card para lá
                      const id = addArea(phase.id, where.area.name)
                      if (id) moveTaskToArea(task.id, id)
                      return
                    }
                    const sameName = phase.areas.find((a) => a.name === where.area.name)
                    moveTaskToArea(task.id, (sameName ?? phase.areas[0]).id)
                  }}
                >
                  {state.phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </span>
            ) : null}
            {where ? (
              <span className="flex items-center gap-1.5">
                Área
                <select
                  className="field h-7 w-auto py-0 text-xs"
                  aria-label="Mover para a área"
                  value={where.area.id}
                  onChange={(e) => {
                    if (e.target.value === '__new') setNewAreaName('')
                    else moveTaskToArea(task.id, e.target.value)
                  }}
                >
                  {where.phase.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  <option value="__new">+ Nova área…</option>
                </select>
              </span>
            ) : null}
            {where && newAreaName !== null ? (
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const id = addArea(where.phase.id, newAreaName)
                  if (!id) return
                  moveTaskToArea(task.id, id)
                  setNewAreaName(null)
                }}
              >
                <input
                  autoFocus
                  className="field h-7 w-auto min-w-0 flex-1 py-0 text-xs uppercase sm:max-w-xs"
                  placeholder={`Nova área em ${where.phase.name}`}
                  aria-label="Nome da nova área"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setNewAreaName(null)}
                />
                <button
                  type="submit"
                  className="btn-secondary h-7 px-2.5 py-0 text-xs"
                  disabled={!newAreaName.trim()}
                >
                  Criar e mover
                </button>
                <button
                  type="button"
                  className="btn-ghost h-7 px-2 py-0 text-xs"
                  onClick={() => setNewAreaName(null)}
                >
                  Cancelar
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid gap-6 overflow-y-auto px-5 py-5 sm:px-6">
        {/* Etiquetas */}
        <section>
          <SectionTitle icon={<Tag className="size-4" aria-hidden />}>Etiquetas</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taskLabels.map((l) => (
              <LabelChip key={l.id} label={l} size="md" />
            ))}
            <LabelPicker task={task} labels={labels} />
            <WhatsAppBadge task={task} people={people} />
          </div>
        </section>

        {/* Link */}
        <section>
          <SectionTitle icon={<Link2 className="size-4" aria-hidden />}>Link</SectionTitle>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              className={`field ${linkInvalid ? 'border-danger' : ''}`}
              aria-invalid={linkInvalid}
              aria-label="Link do card"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={commitLink}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
            {task.link ? (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn"
                aria-label="Abrir link em nova aba"
                title="Abrir"
              >
                <ExternalLink className="size-4" aria-hidden />
              </a>
            ) : null}
          </div>
          {linkInvalid ? (
            <p className="mt-1 text-xs text-danger">
              Use um endereço começando com http:// ou https://
            </p>
          ) : null}
        </section>

        {/* Descrição */}
        <section>
          <SectionTitle icon={<AlignLeft className="size-4" aria-hidden />}>Descrição</SectionTitle>
          <AutoTextarea
            className="field mt-2"
            minRows={3}
            placeholder="Contexto, critérios de pronto, observações"
            aria-label="Descrição do card"
            value={desc}
            onChange={(v) => {
              setDesc(v)
              patchTask(task.id, { description: v })
            }}
          />
        </section>

        <TaskActivity taskId={task.id} />

        {/* Checklists */}
        <section>
          <SectionTitle icon={<CheckSquare className="size-4" aria-hidden />}>
            Checklists
          </SectionTitle>
          <div className="mt-2 grid gap-5">
            {(task.checklists ?? []).map((c) => (
              <ChecklistBlock key={c.id} taskId={task.id} checklist={c} />
            ))}
            <AddChecklist taskId={task.id} />
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 sm:px-6">
        <button
          type="button"
          className="btn-danger"
          onClick={() =>
            confirm({
              title: 'Excluir este card?',
              description: `"${task.label}" e tudo que está dentro dele serão removidos. Isso não pode ser desfeito.`,
              confirmLabel: 'Excluir',
              danger: true,
              onConfirm: () => {
                removeTask(task.id)
                onClose()
              },
            })
          }
        >
          <Trash2 className="size-4" aria-hidden /> Excluir card
        </button>
        <div className="flex items-center gap-2">
          {canNotify ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={notifying}
              title={`Reenvia no WhatsApp de ${owners.map((p) => p.name).join(', ')} o card como está agora: título, prazo e checklists`}
              onClick={async () => {
                setNotifying(true)
                try {
                  await getSync()?.flush()
                  const r = await sendTaskUpdate(task, profile)
                  toast(`Aviso atualizado na fila para ${r.names.join(', ')}`)
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Não foi possível enviar')
                } finally {
                  setNotifying(false)
                }
              }}
            >
              <Send className="size-4" aria-hidden />
              {notifying ? 'Enviando…' : 'Atualizar aviso'}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
      {icon}
      {children}
    </h3>
  )
}

// ---------- Checklists ----------

function ChecklistBlock({ taskId, checklist }: { taskId: string; checklist: TaskChecklist }) {
  const {
    patchChecklist,
    removeChecklist,
    addChecklistItem,
    patchChecklistItem,
    removeChecklistItem,
  } = useLaunchActions()
  const confirm = useConfirm()
  const [title, setTitle] = useState(checklist.title)
  const [newItem, setNewItem] = useState('')
  const done = checklist.items.filter((i) => i.done).length
  const pct = checklist.items.length ? Math.round((done / checklist.items.length) * 100) : 0

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-md bg-transparent font-semibold outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Título da checklist"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const clean = title.trim()
            if (clean && clean !== checklist.title)
              patchChecklist(taskId, checklist.id, { title: clean })
            else setTitle(checklist.title)
          }}
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {done}/{checklist.items.length}
        </span>
        <button
          type="button"
          className="icon-btn hover:text-danger"
          aria-label={`Excluir checklist ${checklist.title}`}
          onClick={() =>
            confirm({
              title: `Excluir a checklist ${checklist.title}?`,
              description: checklist.items.length
                ? `Os ${checklist.items.length} itens dela serão removidos.`
                : undefined,
              confirmLabel: 'Excluir',
              danger: true,
              onConfirm: () => removeChecklist(taskId, checklist.id),
            })
          }
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <ProgressBar value={pct} className="mt-2" tone="lime" label={`${checklist.title}: ${pct}%`} />
      <ul className="mt-2 grid gap-1">
        {checklist.items.map((i) => (
          <ChecklistItemRow
            key={i.id}
            item={i}
            onToggle={(v) => patchChecklistItem(taskId, checklist.id, i.id, { done: v })}
            onRename={(t) => patchChecklistItem(taskId, checklist.id, i.id, { text: t })}
            onRemove={() => removeChecklistItem(taskId, checklist.id, i.id)}
          />
        ))}
      </ul>
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (addChecklistItem(taskId, checklist.id, newItem)) setNewItem('')
        }}
      >
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          className="field h-8 border-dashed bg-transparent py-0 text-sm"
          placeholder="Adicionar item"
          aria-label={`Novo item em ${checklist.title}`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button type="submit" className="btn-secondary h-8 py-0 text-xs" disabled={!newItem.trim()}>
          Adicionar
        </button>
      </form>
    </div>
  )
}

function ChecklistItemRow({
  item,
  onToggle,
  onRename,
  onRemove,
}: {
  item: { id: string; text: string; done: boolean }
  onToggle: (v: boolean) => void
  onRename: (t: string) => void
  onRemove: () => void
}) {
  const [text, setText] = useState(item.text)
  return (
    <li className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/60">
      <input
        type="checkbox"
        className="checkbox"
        checked={item.done}
        aria-label={`Concluir: ${item.text}`}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <input
        className={`min-w-0 flex-1 rounded-md bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/30 ${item.done ? 'text-muted-foreground line-through' : ''}`}
        aria-label="Texto do item"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const clean = text.trim()
          if (clean && clean !== item.text) onRename(clean)
          else setText(item.text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      <button
        type="button"
        className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
        aria-label={`Remover item: ${item.text}`}
        onClick={onRemove}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}

function AddChecklist({ taskId }: { taskId: string }) {
  const { addChecklist } = useLaunchActions()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  if (!adding)
    return (
      <button
        type="button"
        className="btn-ghost w-fit border-dashed"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-4" aria-hidden /> Nova checklist
      </button>
    )
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        addChecklist(taskId, title)
        setTitle('')
        setAdding(false)
      }}
    >
      <input
        autoFocus
        className="field sm:max-w-xs"
        placeholder="Título (ex.: Entregáveis)"
        aria-label="Título da nova checklist"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-secondary">
          Criar
        </button>
        <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
