import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, Inbox, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { addDays, formatShort, todayIso } from '../../lib/dates'
import { useLaunchState } from '../../store/launchStore'
import {
  FORMAT_COLOR,
  byDay,
  cardColor,
  monthGrid,
  monthTitle,
  mondayOf,
  shiftMonth,
  weekDays,
  type ColorBy,
} from '../calendar'
import { CardDrawer } from '../CardDrawer'
import { FilterBar } from '../FilterBar'
import {
  EMPTY_FILTER,
  FORMATS,
  FORMAT_LABEL,
  isLate,
  isPublished,
  matchesFilter,
  type CardFilter,
  type ContentCard,
  type ContentState,
} from '../model'
import { useIsClient } from '../roles'
import { CadenceStrip } from '../CadenceStrip'
import { useCardParam } from '../useCardParam'
import { contentOf, useContentActions } from '../useContent'
import { FORMAT_ICON, SOLID } from '../visual'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const NO_DATE = 'nodate'
const MAX_CHIPS = 3

export function CalendarPage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const a = useContentActions()
  const client = useIsClient()
  const today = todayIso()
  const [params, setParams] = useSearchParams()
  const view = params.get('ver') === 'semana' ? 'semana' : 'mes'
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia') ?? '') ? params.get('dia')! : today
  const [openId, open, close] = useCardParam()
  const [filter, setFilter] = useState<CardFilter>(EMPTY_FILTER)
  const [colorBy, setColorBy] = useState<ColorBy>('campanha')
  const [dragId, setDragId] = useState<string | null>(null)

  const setView = (v: 'mes' | 'semana', dia = anchor) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('ver', v)
      n.set('dia', dia)
      return n
    })

  const visible = content.cards.filter((k) => matchesFilter(k, filter))
  const days = byDay(visible)
  const undated = visible.filter((k) => !k.publishAt && !isPublished(content, k))
  const month = anchor.slice(0, 7)
  const grid = view === 'mes' ? monthGrid(month) : weekDays(anchor)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const over = e.over ? String(e.over.id) : ''
    const id = String(e.active.id)
    const card = content.cards.find((k) => k.id === id)
    if (!card || !over) return
    const target = over === NO_DATE ? '' : over.replace('day:', '')
    if (target !== card.publishAt) a.updateCard(id, { publishAt: target })
  }

  const step = (n: number) => {
    if (view === 'mes') setView('mes', `${shiftMonth(month, n)}-01`)
    else setView('semana', addDays(mondayOf(anchor), 7 * n))
  }
  const title =
    view === 'mes' ? monthTitle(month) : `${formatShort(grid[0])} a ${formatShort(grid[6])}`
  const dragged = dragId ? content.cards.find((k) => k.id === dragId) : undefined

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
            Calendário editorial
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              className="icon-btn"
              aria-label="Anterior"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider hover:bg-muted"
              onClick={() => setView(view, today)}
            >
              Hoje
            </button>
            <button type="button" className="icon-btn" aria-label="Próximo" onClick={() => step(1)}>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div
            className="flex rounded-lg border border-border bg-surface p-0.5"
            role="group"
            aria-label="Visão"
          >
            {(['mes', 'semana'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                  view === v ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                }`}
              >
                {v === 'mes' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
          <select
            className="field h-9 w-auto py-0 pr-7 text-xs font-semibold"
            aria-label="Cor dos cards"
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as ColorBy)}
          >
            <option value="campanha">Cor por campanha</option>
            <option value="formato">Cor por formato</option>
            <option value="status">Cor por status</option>
          </select>
        </div>
      </div>

      <FilterBar
        value={filter}
        onChange={setFilter}
        content={content}
        labels={s.labels}
        people={s.people}
      />
      <Legend content={content} colorBy={colorBy} />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="grid grid-cols-7 border-b border-border bg-surface-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="label-mono px-2 py-2 text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((iso, i) => (
                  <DayCell
                    key={iso}
                    iso={iso}
                    today={today}
                    outside={view === 'mes' && iso.slice(0, 7) !== month}
                    tall={view === 'semana'}
                    lastRow={i >= grid.length - 7}
                    cards={days.get(iso) ?? []}
                    content={content}
                    colorBy={colorBy}
                    readOnly={client}
                    onOpen={open}
                    onMore={() => setView('semana', iso)}
                    onCreate={(title) =>
                      open(a.createCard(content.columns[0]?.id ?? '', title, { publishAt: iso }))
                    }
                  />
                ))}
              </div>
            </div>
            <CadenceStrip content={content} days={grid} />
          </div>
          <NoDateTray
            cards={undated}
            content={content}
            colorBy={colorBy}
            readOnly={client}
            onOpen={open}
          />
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged ? (
            <div className="w-48">
              <Chip card={dragged} content={content} colorBy={colorBy} today={today} lifted />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function Legend({ content, colorBy }: { content: ContentState; colorBy: ColorBy }) {
  const items =
    colorBy === 'formato'
      ? FORMATS.map((f) => ({ key: f, name: FORMAT_LABEL[f], color: FORMAT_COLOR[f] }))
      : colorBy === 'status'
        ? content.columns.map((c) => ({ key: c.id, name: c.name, color: c.color }))
        : [
            ...content.campaigns.map((c) => ({ key: c.id, name: c.name, color: c.color })),
            { key: '-', name: 'Sem campanha', color: 'gray' as const },
          ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`size-2.5 rounded-sm ${SOLID[it.color]}`} aria-hidden />
          {it.name}
        </li>
      ))}
    </ul>
  )
}

function DayCell({
  iso,
  today,
  outside,
  tall,
  lastRow,
  cards,
  content,
  colorBy,
  readOnly,
  onOpen,
  onMore,
  onCreate,
}: {
  iso: string
  today: string
  outside: boolean
  tall: boolean
  lastRow: boolean
  cards: ContentCard[]
  content: ContentState
  colorBy: ColorBy
  readOnly: boolean
  onOpen: (id: string) => void
  onMore: () => void
  onCreate: (title: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}`, disabled: readOnly })
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const isToday = iso === today
  const shown = tall ? cards : cards.slice(0, MAX_CHIPS)
  const dow = new Date(`${iso}T12:00:00`).getDay()
  return (
    <div
      ref={setNodeRef}
      className={`group relative flex min-w-0 flex-col gap-1 border-border p-1.5 transition-colors ${
        tall ? 'min-h-[26rem]' : 'min-h-28 sm:min-h-32'
      } ${dow === 0 ? '' : 'border-r'} ${lastRow ? '' : 'border-b'} ${
        isOver ? 'bg-pink-soft/40' : outside ? 'bg-surface-2/70' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
            isToday
              ? 'bg-primary text-primary-foreground'
              : outside
                ? 'text-muted-foreground/60'
                : ''
          }`}
        >
          {Number(iso.slice(8))}
        </span>
        {!readOnly ? (
          <button
            type="button"
            className="icon-btn size-6 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            aria-label={`Novo card em ${formatShort(iso)}`}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {shown.map((k) => (
        <DraggableChip
          key={k.id}
          card={k}
          content={content}
          colorBy={colorBy}
          today={today}
          readOnly={readOnly}
          onOpen={() => onOpen(k.id)}
        />
      ))}
      {!tall && cards.length > MAX_CHIPS ? (
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-left text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onMore}
        >
          +{cards.length - MAX_CHIPS} mais
        </button>
      ) : null}
      {adding ? (
        <form
          className="mt-auto"
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) onCreate(title)
            setTitle('')
            setAdding(false)
          }}
        >
          <input
            autoFocus
            className="field h-8 px-2 py-0 text-xs"
            placeholder="Título e Enter"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (!title.trim()) setAdding(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        </form>
      ) : null}
    </div>
  )
}

function DraggableChip({
  card,
  content,
  colorBy,
  today,
  readOnly,
  onOpen,
}: {
  card: ContentCard
  content: ContentState
  colorBy: ColorBy
  today: string
  readOnly: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: readOnly,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Abrir card: ${card.title || 'sem título'}`}
      onClick={onOpen}
      className={`block w-full touch-manipulation text-left ${isDragging ? 'opacity-30' : ''}`}
    >
      <Chip card={card} content={content} colorBy={colorBy} today={today} />
    </button>
  )
}

function Chip({
  card,
  content,
  colorBy,
  today,
  lifted,
}: {
  card: ContentCard
  content: ContentState
  colorBy: ColorBy
  today: string
  lifted?: boolean
}) {
  const color = cardColor(content, card, colorBy)
  const Icon = FORMAT_ICON[card.format]
  const late = isLate(content, card, today)
  const done = isPublished(content, card)
  return (
    <span
      className={`flex min-w-0 overflow-hidden rounded-md border border-border bg-surface text-[11px] leading-tight transition-colors hover:border-muted-foreground/40 ${
        lifted ? 'shadow-xl' : ''
      } ${done ? 'opacity-55' : ''}`}
      title={card.title}
    >
      <span className={`w-1 shrink-0 ${SOLID[color]}`} aria-hidden />
      {/* hora e formato numa linha; o título ganha até duas linhas para ser lido sem abrir */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-1.5 py-1">
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Icon className="size-3 shrink-0" aria-hidden />
          {card.publishTime ? <span className="tabular-nums">{card.publishTime}</span> : null}
        </span>
        <span
          className={`line-clamp-2 font-semibold [overflow-wrap:anywhere] ${late ? 'text-danger' : ''} ${done ? 'line-through' : ''}`}
        >
          {card.title || 'Sem título'}
        </span>
      </span>
    </span>
  )
}

function NoDateTray({
  cards,
  content,
  colorBy,
  readOnly,
  onOpen,
}: {
  cards: ContentCard[]
  content: ContentState
  colorBy: ColorBy
  readOnly: boolean
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: NO_DATE, disabled: readOnly })
  const today = todayIso()
  return (
    <aside
      ref={setNodeRef}
      aria-label="Sem data"
      className={`flex max-h-[40rem] flex-col gap-2 self-start rounded-2xl border border-border p-3 transition-colors lg:sticky lg:top-20 ${
        isOver ? 'bg-pink-soft/40' : 'bg-muted/50'
      }`}
    >
      <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.06em]">
        <Inbox className="size-4 text-muted-foreground" aria-hidden /> Sem data
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </h2>
      <p className="text-xs text-muted-foreground">
        {readOnly
          ? 'Conteúdos ainda sem dia marcado.'
          : 'Arraste para um dia do calendário para agendar. Solte aqui para tirar a data.'}
      </p>
      <div className="flex min-h-10 flex-col gap-1.5 overflow-y-auto">
        {cards.map((k) => (
          <DraggableChip
            key={k.id}
            card={k}
            content={content}
            colorBy={colorBy}
            today={today}
            readOnly={readOnly}
            onOpen={() => onOpen(k.id)}
          />
        ))}
      </div>
    </aside>
  )
}
