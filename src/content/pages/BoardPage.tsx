import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useConfirm } from '../../components/confirmContext'
import { LABEL_COLOR_NAMES } from '../../data/labels'
import type { Label, LabelColor, Person } from '../../data/types'
import { todayIso } from '../../lib/dates'
import { useLaunchState } from '../../store/launchStore'
import { CardDrawer } from '../CardDrawer'
import { FilterBar } from '../FilterBar'
import {
  EMPTY_FILTER,
  cardsIn,
  isFiltering,
  isLate,
  matchesFilter,
  type CardFilter,
  type ContentCard,
  type ContentColumn,
  type ContentState,
} from '../model'
import { CardFace } from '../ui'
import { SOLID } from '../visual'
import { contentOf, useContentActions } from '../useContent'
import { useIsClient } from '../roles'

const COLUMN_PREFIX = 'col:'

/** Ids visíveis por coluna, na ordem do quadro. */
function visibleIds(c: ContentState, f: CardFilter): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const col of c.columns)
    out[col.id] = cardsIn(c, col.id)
      .filter((k) => matchesFilter(k, f))
      .map((k) => k.id)
  return out
}

function containerOf(items: Record<string, string[]>, id: string): string | undefined {
  if (id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length)
  return Object.keys(items).find((col) => items[col].includes(id))
}

/**
 * Posição final entre TODOS os cards da coluna, a partir da posição entre os visíveis
 * (com filtro ligado há cards escondidos no meio).
 */
function fullIndex(c: ContentState, columnId: string, visible: string[], cardId: string): number {
  const all = cardsIn(c, columnId).filter((k) => k.id !== cardId)
  const i = visible.indexOf(cardId)
  const next = visible[i + 1]
  if (next) {
    const j = all.findIndex((k) => k.id === next)
    if (j !== -1) return j
  }
  const prev = visible[i - 1]
  if (prev) {
    const j = all.findIndex((k) => k.id === prev)
    if (j !== -1) return j + 1
  }
  return all.length
}

export function BoardPage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const a = useContentActions()
  const client = useIsClient()
  const [params, setParams] = useSearchParams()
  const openId = params.get('card')
  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER)
  const [drag, setDrag] = useState<{ id: string; items: Record<string, string[]> } | null>(null)
  const today = todayIso()

  const base = visibleIds(content, filter)
  const items = drag?.items ?? base
  const byId = new Map(content.cards.map((k) => [k.id, k]))
  const campaigns = new Map(content.campaigns.map((c) => [c.id, c]))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const open = (id: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('card', id)
        return n
      },
      { replace: false },
    )
  const close = () =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('card')
      return n
    })

  function onDragStart(e: DragStartEvent) {
    setDrag({ id: String(e.active.id), items: base })
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over ? String(e.over.id) : null
    if (!drag || !overId) return
    const activeId = String(e.active.id)
    const from = containerOf(drag.items, activeId)
    const to = containerOf(drag.items, overId)
    if (!from || !to || from === to) return
    setDrag((d) => {
      if (!d) return d
      const src = d.items[from].filter((x) => x !== activeId)
      const dst = [...d.items[to]]
      const overIndex = dst.indexOf(overId)
      dst.splice(overIndex === -1 ? dst.length : overIndex, 0, activeId)
      return { ...d, items: { ...d.items, [from]: src, [to]: dst } }
    })
  }

  function onDragEnd(e: DragEndEvent) {
    const d = drag
    setDrag(null)
    if (!d || !e.over) return
    const activeId = String(e.active.id)
    const overId = String(e.over.id)
    const col = containerOf(d.items, activeId)
    if (!col) return
    let list = d.items[col]
    const overCol = containerOf(d.items, overId)
    if (overCol === col && !overId.startsWith(COLUMN_PREFIX)) {
      const oldIndex = list.indexOf(activeId)
      const newIndex = list.indexOf(overId)
      if (oldIndex !== newIndex && newIndex !== -1) list = arrayMove(list, oldIndex, newIndex)
    }
    a.move(activeId, col, fullIndex(content, col, list, activeId))
  }

  const active = drag ? byId.get(drag.id) : undefined
  const filtering = isFiltering(filter)
  const total = content.cards.filter((k) => matchesFilter(k, filter)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono flex items-center gap-2">
            <span className="brand-squares" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Quadro de conteúdo
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Quadro</h1>
        </div>
        {!client ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => open(a.createCard(content.columns[0]?.id ?? '', ''))}
          >
            <Plus className="size-4" aria-hidden /> Novo card
          </button>
        ) : null}
      </div>

      <FilterBar
        value={filter}
        onChange={setFilter}
        content={content}
        labels={s.labels}
        people={s.people}
      />
      {filtering ? (
        <p className="text-xs font-semibold text-muted-foreground" role="status">
          {total} {total === 1 ? 'card' : 'cards'} com esses filtros
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-5 sm:px-5 md:snap-none">
          {content.columns.map((col, i) => (
            <Column
              key={col.id}
              column={col}
              index={i}
              count={content.columns.length}
              ids={items[col.id] ?? []}
              totalInColumn={cardsIn(content, col.id).length}
              readOnly={client}
            >
              {(items[col.id] ?? []).map((id) => {
                const k = byId.get(id)
                if (!k) return null
                return (
                  <SortableCard
                    key={id}
                    card={k}
                    disabled={client}
                    onOpen={() => open(id)}
                    labels={s.labels}
                    people={s.people}
                    content={content}
                    campaigns={campaigns}
                    today={today}
                  />
                )
              })}
            </Column>
          ))}
          {!client ? <NewColumn /> : null}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {active ? (
            <div className="w-[17.5rem] rotate-[1.5deg] cursor-grabbing drop-shadow-xl">
              <CardFace
                card={active}
                labels={s.labels}
                people={s.people}
                campaign={campaigns.get(active.campaignId)}
                today={today}
                late={isLate(content, active, today)}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function SortableCard({
  card,
  disabled,
  onOpen,
  labels,
  people,
  content,
  campaigns,
  today,
}: {
  card: ContentCard
  disabled: boolean
  onOpen: () => void
  labels: Label[]
  people: Person[]
  content: ContentState
  campaigns: Map<string, ContentState['campaigns'][number]>
  today: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group list-none ${isDragging ? 'opacity-30' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Abrir card: ${card.title || 'sem título'}`}
        className="block w-full cursor-pointer touch-manipulation text-left outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
        onKeyDown={(e) => {
          // espaço pega o card para mover pelo teclado (dnd-kit); Enter abre
          if (e.key === 'Enter') onOpen()
          else listeners?.onKeyDown?.(e)
        }}
      >
        <CardFace
          card={card}
          labels={labels}
          people={people}
          campaign={campaigns.get(card.campaignId)}
          today={today}
          late={isLate(content, card, today)}
        />
      </div>
    </li>
  )
}

function Column({
  column,
  index,
  count,
  ids,
  totalInColumn,
  readOnly,
  children,
}: {
  column: ContentColumn
  index: number
  count: number
  ids: string[]
  totalInColumn: number
  readOnly: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${column.id}` })
  const a = useContentActions()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (adding) input.current?.focus()
  }, [adding])

  const submit = () => {
    if (title.trim()) a.createCard(column.id, title)
    setTitle('')
    input.current?.focus()
  }

  return (
    <section
      aria-label={column.name}
      className={`flex w-[85vw] max-w-[19rem] shrink-0 snap-start flex-col rounded-2xl bg-muted/60 transition-colors sm:w-[18.5rem] lg:max-h-[calc(100dvh-13rem)] ${
        isOver ? 'bg-muted' : ''
      }`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`size-2.5 shrink-0 rounded-full ${SOLID[column.color]}`} aria-hidden />
        <h2 className="min-w-0 truncate font-display text-sm font-bold uppercase tracking-[0.06em]">
          {column.name}
        </h2>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
          {ids.length === totalInColumn ? totalInColumn : `${ids.length}/${totalInColumn}`}
        </span>
        {column.clientApproves ? (
          <span title="O cliente aprova nesta coluna" className="text-blue">
            <ShieldCheck className="size-3.5" aria-label="Cliente aprova aqui" />
          </span>
        ) : null}
        {!readOnly ? (
          <ColumnMenu column={column} index={index} count={count} total={totalInColumn} />
        ) : null}
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pt-0.5 pb-2 [scrollbar-width:thin]"
        >
          {children}
          {ids.length === 0 ? (
            <li className="list-none rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
              {readOnly ? 'Nada aqui.' : 'Arraste um card para cá'}
            </li>
          ) : null}
        </ul>
      </SortableContext>
      {!readOnly ? (
        <div className="px-2 pb-2">
          {adding ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <textarea
                ref={input}
                rows={2}
                className="field resize-none text-sm"
                placeholder="Título do conteúdo"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                  if (e.key === 'Escape') setAdding(false)
                }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn-secondary h-8 px-3 py-0 text-xs"
                  disabled={!title.trim()}
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 px-3 py-0 text-xs"
                  onClick={() => {
                    setAdding(false)
                    setTitle('')
                  }}
                >
                  Fechar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden /> Adicionar card
            </button>
          )}
        </div>
      ) : null}
    </section>
  )
}

const COLORS: LabelColor[] = ['gray', 'pink', 'blue', 'aqua', 'lime', 'black']

function ColumnMenu({
  column,
  index,
  count,
  total,
}: {
  column: ContentColumn
  index: number
  count: number
  total: number
}) {
  const a = useContentActions()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(column.name)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        className="icon-btn size-7"
        aria-label={`Opções da coluna ${column.name}`}
        aria-expanded={open}
        onClick={() => {
          setName(column.name)
          setOpen((o) => !o)
        }}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open ? (
        <div className="fade-in absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) a.updateColumn(column.id, { name: name.trim().slice(0, 60) })
            }}
          >
            <input
              className="field h-8 py-0 text-sm"
              value={name}
              aria-label="Nome da coluna"
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name.trim() !== column.name)
                  a.updateColumn(column.id, { name: name.trim().slice(0, 60) })
              }}
            />
            <button type="submit" className="icon-btn size-8" aria-label="Salvar nome">
              <Check className="size-4" aria-hidden />
            </button>
          </form>
          <p className="label-mono mt-3 mb-1.5">Cor</p>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={LABEL_COLOR_NAMES[c]}
                aria-pressed={column.color === c}
                onClick={() => a.updateColumn(column.id, { color: c })}
                className={`size-6 rounded-md ${SOLID[c]} ${column.color === c ? 'ring-2 ring-ring ring-offset-2 ring-offset-surface' : ''}`}
              />
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={column.clientApproves}
              onChange={(e) => a.updateColumn(column.id, { clientApproves: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Cliente aprova aqui</span>
              <span className="block text-xs text-muted-foreground">
                O card entra na fila de aprovação do cliente. Aprovado, anda para a próxima coluna.
              </span>
            </span>
          </label>
          <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
            <button
              type="button"
              className="btn-ghost h-8 flex-1 px-2 py-0 text-xs"
              disabled={index === 0}
              onClick={() => a.shiftColumn(column.id, -1)}
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Esquerda
            </button>
            <button
              type="button"
              className="btn-ghost h-8 flex-1 px-2 py-0 text-xs"
              disabled={index === count - 1}
              onClick={() => a.shiftColumn(column.id, 1)}
            >
              Direita <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="btn-danger mt-2 h-8 w-full py-0 text-xs"
            disabled={count <= 1}
            onClick={() => {
              setOpen(false)
              confirm({
                title: `Excluir a coluna ${column.name}?`,
                description: total
                  ? `Os ${total} cards dela vão para a coluna ao lado. Nenhum card é apagado.`
                  : 'A coluna está vazia.',
                confirmLabel: 'Excluir coluna',
                danger: true,
                onConfirm: () => a.deleteColumn(column.id),
              })
            }}
          >
            <Trash2 className="size-3.5" aria-hidden /> Excluir coluna
          </button>
        </div>
      ) : null}
    </div>
  )
}

function NewColumn() {
  const a = useContentActions()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  if (!adding)
    return (
      <button
        type="button"
        className="flex h-12 w-[16rem] shrink-0 snap-start items-center gap-2 rounded-2xl border border-dashed border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-4" aria-hidden /> Nova coluna
      </button>
    )
  return (
    <form
      className="flex w-[16rem] shrink-0 flex-col gap-2 self-start rounded-2xl bg-muted/60 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        a.createColumn(name)
        setName('')
        setAdding(false)
      }}
    >
      <input
        className="field h-9 py-0 text-sm"
        placeholder="Nome da coluna"
        value={name}
        maxLength={60}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAdding(false)
        }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn-secondary h-8 px-3 py-0 text-xs"
          disabled={!name.trim()}
        >
          Criar
        </button>
        <button
          type="button"
          className="btn-ghost h-8 px-3 py-0 text-xs"
          onClick={() => setAdding(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
