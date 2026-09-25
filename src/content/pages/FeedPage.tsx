import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { useToast } from '../../components/toastContext'
import { formatShort } from '../../lib/dates'
import { boardName, useLaunchState } from '../../store/launchStore'
import { CardDrawer } from '../CardDrawer'
import { Cover } from '../ui'
import {
  FORMATS,
  FORMAT_LABEL,
  NETWORKS,
  NETWORK_LABEL,
  columnOf,
  type ContentCard,
  type ContentState,
  type Network,
} from '../model'
import { useIsClient } from '../roles'
import { feedCards, type Scope } from '../feed'
import { useCardParam } from '../useCardParam'
import { contentOf, useContentActions } from '../useContent'
import { FORMAT_COLOR } from '../calendar'
import { FORMAT_ICON, ON_SOLID, SOFT, SOLID, initials } from '../visual'

/** Grade do feed: como o perfil vai ficar, para o time e o cliente verem a harmonia antes de postar. */
export function FeedPage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const a = useContentActions()
  const toast = useToast()
  const client = useIsClient()
  const [openId, open, close] = useCardParam()
  const used = NETWORKS.filter((n) => content.cards.some((k) => k.networks.includes(n)))
  const [network, setNetwork] = useState<Network>(used[0] ?? 'instagram')
  const [scope, setScope] = useState<Scope>('tudo')
  const cards = feedCards(content, network, scope)
  const name = boardName(s)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /** Soltar um post sobre outro troca as datas (e horários) dos dois. */
  function onDragEnd(e: DragEndEvent) {
    const from = content.cards.find((k) => k.id === String(e.active.id))
    const to = e.over ? content.cards.find((k) => k.id === String(e.over!.id)) : undefined
    if (!from || !to || from.id === to.id) return
    a.updateCard(from.id, { publishAt: to.publishAt, publishTime: to.publishTime })
    a.updateCard(to.id, { publishAt: from.publishAt, publishTime: from.publishTime })
    toast(`Datas trocadas: ${from.title || 'post'} ↔ ${to.title || 'post'}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono flex items-center gap-2">
            <span className="brand-squares" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Prévia do perfil
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Grade do feed</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="field h-9 w-auto py-0 pr-7 text-xs font-semibold"
            aria-label="Rede"
            value={network}
            onChange={(e) => setNetwork(e.target.value as Network)}
          >
            {(used.length ? used : NETWORKS).map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABEL[n]}
              </option>
            ))}
          </select>
          <div
            className="flex rounded-lg border border-border bg-surface p-0.5"
            role="group"
            aria-label="O que mostrar"
          >
            {(['tudo', 'agenda'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={scope === v}
                onClick={() => setScope(v)}
                className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                  scope === v ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                }`}
              >
                {v === 'tudo' ? 'Planejado' : 'Só programado e no ar'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[26rem] overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-4 px-5 pt-6 pb-4">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-primary font-display text-xl font-extrabold text-primary-foreground ring-4 ring-pink-soft">
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold">{name}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground tabular-nums">{cards.length}</span>{' '}
                {cards.length === 1 ? 'publicação' : 'publicações'} na grade
              </p>
            </div>
          </div>
          {cards.length === 0 ? (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum post de {NETWORK_LABEL[network]} com data
              {scope === 'agenda' ? ' em Programado ou Publicado' : ''} ainda.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={cards.map((k) => k.id)} strategy={rectSortingStrategy}>
                <ul className="grid grid-cols-3 gap-0.5 border-t border-border">
                  {cards.map((k) => (
                    <Tile
                      key={k.id}
                      card={k}
                      content={content}
                      readOnly={client}
                      onOpen={() => open(k.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Balance cards={cards.slice(0, 12)} content={content} />
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              A grade mostra os posts de {NETWORK_LABEL[network]} na ordem do perfil: o mais novo em
              cima, à esquerda. Stories ficam de fora.
            </p>
            {!client ? (
              <p>
                <span className="font-semibold text-foreground">Arraste um post sobre outro</span>{' '}
                para trocar as datas dos dois e testar outra sequência.
              </p>
            ) : null}
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-lime" aria-hidden /> No ar
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" aria-hidden /> Programado
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border border-muted-foreground" aria-hidden />
                Em produção ou revisão
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function Tile({
  card,
  content,
  readOnly,
  onOpen,
}: {
  card: ContentCard
  content: ContentState
  readOnly: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: readOnly,
  })
  const stage = columnOf(content, card)?.stage
  const Icon = FORMAT_ICON[card.format]
  const color = FORMAT_COLOR[card.format]
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative list-none ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onOpen}
        aria-label={`Abrir: ${card.title || 'sem título'}, ${formatShort(card.publishAt)}`}
        className="group relative block aspect-[3/4] w-full touch-manipulation overflow-hidden bg-muted text-left"
      >
        {card.coverId ? (
          <Cover card={card} className="absolute inset-0 size-full" />
        ) : (
          // sem capa: bloco neutro com a cor do formato, para não pesar na leitura da grade
          <span className={`absolute inset-0 flex flex-col gap-1.5 p-2 pb-8 ${SOFT[color]}`}>
            <span
              className={`inline-flex size-6 items-center justify-center rounded-md ${SOLID[color]} ${ON_SOLID[color]}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="line-clamp-4 text-[11px] font-bold leading-tight text-foreground">
              {card.title || 'Sem título'}
            </span>
          </span>
        )}
        {card.coverId ? (
          <span
            className="absolute top-1.5 right-1.5 rounded bg-black/55 p-0.5 text-white"
            aria-hidden
          >
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <span
            className={`size-2 rounded-full ${
              stage === 'published'
                ? 'bg-lime'
                : stage === 'scheduled'
                  ? 'bg-primary'
                  : 'border border-white bg-transparent'
            }`}
            aria-hidden
          />
          {formatShort(card.publishAt)}
        </span>
        <span
          className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15"
          aria-hidden
        />
      </button>
    </li>
  )
}

/** Equilíbrio das 12 publicações mais recentes da grade: formatos e pilares lado a lado. */
function Balance({ cards, content }: { cards: ContentCard[]; content: ContentState }) {
  if (cards.length === 0) return null
  const formats = FORMATS.map((f) => ({
    key: f,
    label: FORMAT_LABEL[f],
    count: cards.filter((k) => k.format === f).length,
    color: SOLID[FORMAT_COLOR[f]],
  })).filter((x) => x.count > 0)
  const pillars = content.strategy.pillars
    .filter((p) => p.name.trim())
    .map((p) => ({
      key: p.id,
      label: p.name,
      count: cards.filter((k) => k.pillarId === p.id).length,
      color: p.stage === 'topo' ? 'bg-aqua' : p.stage === 'meio' ? 'bg-blue' : 'bg-primary',
    }))
  const noPillar = cards.filter((k) => !k.pillarId).length
  return (
    <section className="card p-5">
      <p className="label-mono">Equilíbrio da grade</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Os {cards.length} posts mais recentes, como aparecem no perfil.
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Bars title="Formato" rows={formats} total={cards.length} />
        {pillars.length ? (
          <Bars
            title="Pilar"
            rows={[
              ...pillars,
              ...(noPillar
                ? [
                    {
                      key: '-',
                      label: 'Sem pilar',
                      count: noPillar,
                      color: 'bg-muted-foreground/40',
                    },
                  ]
                : []),
            ]}
            total={cards.length}
          />
        ) : null}
      </div>
    </section>
  )
}

function Bars({
  title,
  rows,
  total,
}: {
  title: string
  rows: { key: string; label: string; count: number; color: string }[]
  total: number
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider">{title}</p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-bold tabular-nums">{r.count}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${r.color}`}
                style={{ width: `${Math.round((r.count / total) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
