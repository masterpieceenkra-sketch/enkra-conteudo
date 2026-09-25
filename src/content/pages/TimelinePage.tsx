import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { addDays, diffDays, formatBr, formatShort, todayIso } from '../../lib/dates'
import { dragResult } from '../../lib/ganttDrag'
import { useLaunchState } from '../../store/launchStore'
import { CampaignDialog } from '../CampaignDialog'
import { CardDrawer } from '../CardDrawer'
import { isLate, isPublished, type Campaign, type ContentCard, type ContentState } from '../model'
import { useIsClient } from '../roles'
import { timelineRange, type TimelineDrag } from '../timeline'
import { useCardParam } from '../useCardParam'
import { contentOf, useContentActions } from '../useContent'
import { FORMAT_ICON, ON_SOLID, SOLID } from '../visual'

const LABEL_W = 272
const ZOOM = { semanas: 30, meses: 12 } as const
type Zoom = keyof typeof ZOOM

interface Scale {
  start: string
  end: string
  days: number
  px: number
  width: number
  x: (iso: string) => number
}

function useScale(from: string, to: string, px: number): Scale {
  return useMemo(() => {
    const days = diffDays(from, to) + 1
    return {
      start: from,
      end: to,
      days,
      px,
      width: days * px,
      x: (iso) => diffDays(from, iso) * px,
    }
  }, [from, to, px])
}

/** Cronograma: campanhas como barras (arrastar e esticar) e os posts de cada uma como marcos. */
export function TimelinePage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const a = useContentActions()
  const client = useIsClient()
  const today = todayIso()
  const [openId, open, close] = useCardParam()
  const [zoom, setZoom] = useState<Zoom>('semanas')
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(content.campaigns.map((c) => c.id)),
  )
  const [drag, setDrag] = useState<TimelineDrag | null>(null)
  const suppressClick = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const range = timelineRange(content, today)
  const m = useScale(range.from, range.to, ZOOM[zoom])
  const todayX = today >= m.start && today <= m.end ? m.x(today) + m.px / 2 : null

  useEffect(() => {
    const el = scrollRef.current
    if (!el || todayX === null) return
    el.scrollLeft = Math.max(0, todayX - (el.clientWidth - LABEL_W) / 4)
  }, [todayX, zoom])

  const toggle = (id: string) =>
    setExpanded((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const cardsOf = (campaignId: string) =>
    content.cards
      .filter((k) => k.campaignId === campaignId)
      .sort((x, y) => (x.publishAt || '9999').localeCompare(y.publishAt || '9999'))
  const loose = content.cards
    .filter((k) => !k.campaignId && k.publishAt && k.publishAt >= m.start && k.publishAt <= m.end)
    .sort((x, y) => x.publishAt.localeCompare(y.publishAt))

  function startDrag(
    e: ReactPointerEvent<HTMLElement>,
    kind: TimelineDrag['kind'],
    id: string,
    start: string,
    end: string,
  ) {
    if (client || e.button !== 0) return
    const handle = (e.target as HTMLElement).dataset.handle
    const mode = kind === 'campaign' && (handle === 'start' || handle === 'end') ? handle : 'move'
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // sem captura: o arrasto ainda funciona dentro do elemento
    }
    setDrag({ id, kind, mode, originX: e.clientX, start, end, delta: 0 })
  }
  function moveDrag(e: ReactPointerEvent<HTMLElement>, id: string) {
    if (!drag || drag.id !== id) return
    const delta = Math.round((e.clientX - drag.originX) / m.px)
    if (delta !== drag.delta) setDrag({ ...drag, delta })
  }
  function endDrag(id: string) {
    if (!drag || drag.id !== id) return
    const r = dragResult(drag)
    if (drag.delta !== 0) {
      suppressClick.current = true
      if (drag.kind === 'campaign') {
        const cp = content.campaigns.find((c) => c.id === id)
        if (cp) a.saveCampaign({ ...cp, start: r.start, end: r.end })
      } else a.updateCard(id, { publishAt: r.start })
    }
    setDrag(null)
  }
  const clickGuard = (fn: () => void) => () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    fn()
  }

  const dragProps = (kind: TimelineDrag['kind'], id: string, start: string, end: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startDrag(e, kind, id, start, end),
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => moveDrag(e, id),
    onPointerUp: () => endDrag(id),
    onPointerCancel: () => setDrag(null),
  })

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
            Campanhas no tempo
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Cronograma</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-border bg-surface p-0.5"
            role="group"
            aria-label="Zoom"
          >
            {(Object.keys(ZOOM) as Zoom[]).map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                onClick={() => setZoom(z)}
                className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                  zoom === z ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'
                }`}
              >
                {z === 'semanas' ? 'Semanas' : 'Meses'}
              </button>
            ))}
          </div>
          {!client ? (
            <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" aria-hidden /> Nova campanha
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 rounded-[2px] bg-muted-foreground/70" aria-hidden />
          Post (cor da coluna em que está)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 rounded-[2px] bg-danger" aria-hidden />
          Atrasado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-muted-foreground/60" aria-hidden />
          <span className="h-1 w-5 rounded-full bg-muted-foreground/25" aria-hidden />
          Prazo de produção até a publicação
        </span>
        {!client ? (
          <span className="basis-full sm:ml-auto sm:basis-auto">
            Arraste barras e losangos para mudar as datas; puxe as bordas da barra para esticar.
          </span>
        ) : null}
      </div>

      <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <div className="relative" style={{ width: LABEL_W + m.width, minWidth: '100%' }}>
          <Ruler m={m} todayX={todayX} />
          <Background m={m} todayX={todayX} />

          <div className="relative z-10">
            {content.campaigns.length === 0 ? (
              <div className="flex border-b border-border/60">
                <div
                  className="sticky left-0 z-20 shrink-0 border-r border-border bg-surface px-3 py-4 text-sm text-muted-foreground"
                  style={{ width: LABEL_W }}
                >
                  Nenhuma campanha ainda.
                </div>
                <div className="flex-1 px-4 py-4 text-sm text-muted-foreground">
                  {client
                    ? 'Quando o time criar campanhas, elas aparecem aqui.'
                    : 'Crie a primeira campanha e ligue os cards a ela no painel do card.'}
                </div>
              </div>
            ) : null}
            {content.campaigns.map((cp) => {
              const cards = cardsOf(cp.id)
              const isOpen = expanded.has(cp.id)
              const has = !!cp.start && !!cp.end
              const preview = drag && drag.id === cp.id ? dragResult(drag) : null
              const start = preview?.start ?? cp.start
              const end = preview?.end ?? cp.end
              const published = cards.filter((k) => isPublished(content, k)).length
              return (
                <div key={cp.id}>
                  <div className="flex border-b border-border/60">
                    <div
                      className="sticky left-0 z-20 flex shrink-0 items-start gap-1.5 border-r border-border bg-surface py-2 pr-2 pl-1.5"
                      style={{ width: LABEL_W }}
                    >
                      <button
                        type="button"
                        className="icon-btn size-6"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? `Recolher ${cp.name}` : `Abrir ${cp.name}`}
                        onClick={() => toggle(cp.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-4" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-bold">
                          <span
                            className={`size-2.5 shrink-0 rounded-sm ${SOLID[cp.color]}`}
                            aria-hidden
                          />
                          <span className="truncate">{cp.name}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {cards.length} {cards.length === 1 ? 'post' : 'posts'} · {published} no ar
                        </p>
                      </div>
                      {!client ? (
                        <button
                          type="button"
                          className="icon-btn size-6"
                          aria-label={`Editar ${cp.name}`}
                          onClick={() => setEditing(cp)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <div className="relative h-14 flex-1">
                      {has ? (
                        <button
                          type="button"
                          {...dragProps('campaign', cp.id, cp.start, cp.end)}
                          onClick={clickGuard(() => (client ? toggle(cp.id) : setEditing(cp)))}
                          title={`${cp.name}: ${formatBr(start)} → ${formatBr(end)}`}
                          className={`absolute top-3 flex h-8 select-none items-center overflow-clip rounded-lg px-3 text-left text-xs font-bold shadow-sm transition-[filter] hover:brightness-110 ${SOLID[cp.color]} ${ON_SOLID[cp.color]} ${client ? '' : drag?.id === cp.id ? 'cursor-grabbing shadow-lg' : 'cursor-grab'}`}
                          style={{
                            left: m.x(start),
                            width: Math.max((diffDays(start, end) + 1) * m.px, 24),
                            touchAction: client ? undefined : 'none',
                          }}
                        >
                          {!client ? (
                            <>
                              <span
                                data-handle="start"
                                className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize"
                                aria-hidden
                              />
                              <span
                                data-handle="end"
                                className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize"
                                aria-hidden
                              />
                            </>
                          ) : null}
                          {/* o nome fica preso na borda visível quando a barra começa fora da tela
                              (overflow-clip no botão não cria contexto de rolagem, então o sticky funciona) */}
                          <span className="sticky truncate" style={{ left: LABEL_W + 12 }}>
                            {cp.name} · {formatShort(start)} → {formatShort(end)}
                          </span>
                        </button>
                      ) : !client ? (
                        <button
                          type="button"
                          className="absolute top-4 left-3 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          onClick={() => setEditing(cp)}
                        >
                          Defina início e fim da campanha
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isOpen
                    ? cards.map((k) => (
                        <CardRow
                          key={k.id}
                          card={k}
                          content={content}
                          m={m}
                          today={today}
                          drag={drag}
                          readOnly={client}
                          dragProps={dragProps('card', k.id, k.publishAt, k.publishAt)}
                          onOpen={clickGuard(() => open(k.id))}
                        />
                      ))
                    : null}
                </div>
              )
            })}

            {loose.length ? (
              <div>
                <div className="flex border-b border-border/60 bg-surface-2/60">
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-border bg-surface-2 py-2 pr-2 pl-1.5"
                    style={{ width: LABEL_W }}
                  >
                    <button
                      type="button"
                      className="icon-btn size-6"
                      aria-expanded={expanded.has('-')}
                      aria-label="Posts sem campanha"
                      onClick={() => toggle('-')}
                    >
                      {expanded.has('-') ? (
                        <ChevronDown className="size-4" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4" aria-hidden />
                      )}
                    </button>
                    <p className="text-sm font-bold">
                      Sem campanha{' '}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        · {loose.length}
                      </span>
                    </p>
                  </div>
                  <div className="relative h-10 flex-1">
                    {!expanded.has('-')
                      ? loose.map((k) => (
                          <span
                            key={k.id}
                            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-muted-foreground/60"
                            style={{ left: m.x(k.publishAt) + m.px / 2 }}
                            aria-hidden
                          />
                        ))
                      : null}
                  </div>
                </div>
                {expanded.has('-')
                  ? loose.map((k) => (
                      <CardRow
                        key={k.id}
                        card={k}
                        content={content}
                        m={m}
                        today={today}
                        drag={drag}
                        readOnly={client}
                        dragProps={dragProps('card', k.id, k.publishAt, k.publishAt)}
                        onOpen={clickGuard(() => open(k.id))}
                      />
                    ))
                  : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <CampaignDialog campaign={editing} onClose={() => setEditing(null)} />
      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function Ruler({ m, todayX }: { m: Scale; todayX: number | null }) {
  const months: { label: string; x: number; w: number }[] = []
  let cursor = m.start
  while (cursor <= m.end) {
    const [y, mo] = cursor.split('-').map(Number)
    const last = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10)
    const endIso = last < m.end ? last : m.end
    const raw = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    months.push({
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
      x: m.x(cursor),
      w: (diffDays(cursor, endIso) + 1) * m.px,
    })
    cursor = addDays(endIso, 1)
  }
  const weeks: string[] = []
  for (let d = 0; d < m.days; d += 7) weeks.push(addDays(m.start, d))
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface-2">
      <div className="flex">
        <div
          className="sticky left-0 z-30 shrink-0 border-r border-border bg-surface-2 px-3 py-2 label-mono"
          style={{ width: LABEL_W }}
        >
          Campanha
        </div>
        <div className="relative h-11 flex-1">
          {months.map((mo) => (
            <div
              key={mo.label}
              className="absolute top-0 h-5 overflow-clip border-l border-border text-[11px] font-bold uppercase tracking-wider"
              style={{ left: mo.x, width: mo.w }}
            >
              {/* o mês fica preso na borda visível enquanto a régua rola */}
              <span
                className="sticky inline-block max-w-full truncate px-2"
                style={{ left: LABEL_W }}
              >
                {mo.w >= 60 ? mo.label : ''}
              </span>
            </div>
          ))}
          {m.px >= 20
            ? weeks.map((w) => (
                <div
                  key={w}
                  className="absolute top-5 h-6 border-l border-border pl-1 text-[10px] leading-6 text-muted-foreground"
                  style={{ left: m.x(w) }}
                >
                  {formatBr(w).slice(0, 5)}
                </div>
              ))
            : null}
          {todayX !== null ? (
            <span
              className="absolute top-6 -translate-x-1/2 rounded bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground"
              style={{ left: todayX }}
            >
              hoje
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Background({ m, todayX }: { m: Scale; todayX: number | null }) {
  const weekends: number[] = []
  for (let d = 0; d < m.days; d++) {
    const dow = new Date(`${addDays(m.start, d)}T12:00:00`).getDay()
    if (dow === 0 || dow === 6) weekends.push(d * m.px)
  }
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-0"
      style={{ left: LABEL_W, width: m.width }}
      aria-hidden
    >
      {weekends.map((x) => (
        <div
          key={x}
          className="absolute inset-y-0 bg-foreground/[0.035]"
          style={{ left: x, width: m.px }}
        />
      ))}
      {todayX !== null ? (
        <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: todayX }} />
      ) : null}
    </div>
  )
}

function CardRow({
  card,
  content,
  m,
  today,
  drag,
  readOnly,
  dragProps,
  onOpen,
}: {
  card: ContentCard
  content: ContentState
  m: Scale
  today: string
  drag: TimelineDrag | null
  readOnly: boolean
  dragProps: Record<string, (e: ReactPointerEvent<HTMLElement>) => void>
  onOpen: () => void
}) {
  const Icon = FORMAT_ICON[card.format]
  const column = content.columns.find((c) => c.id === card.columnId)
  const preview = drag && drag.id === card.id ? dragResult(drag).start : card.publishAt
  const inRange = !!preview && preview >= m.start && preview <= m.end
  const late = isLate(content, card, today)
  const dueX =
    card.due && card.due >= m.start && card.due <= m.end ? m.x(card.due) + m.px / 2 : null
  const pubX = inRange ? m.x(preview) + m.px / 2 : null
  return (
    <div className="flex border-b border-border/40">
      <button
        type="button"
        onClick={onOpen}
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border bg-surface py-1.5 pr-2 pl-9 text-left text-xs hover:bg-surface-2"
        style={{ width: LABEL_W }}
        title={card.title}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className={`min-w-0 flex-1 truncate font-medium ${late ? 'text-danger' : ''}`}>
          {card.title || 'Sem título'}
        </span>
        {!card.publishAt ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">sem data</span>
        ) : null}
      </button>
      <div className="relative h-9 flex-1">
        {dueX !== null && pubX !== null && dueX < pubX ? (
          <span
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/25"
            style={{ left: dueX, width: pubX - dueX }}
            title={`Produção até ${formatBr(card.due)}`}
            aria-hidden
          />
        ) : null}
        {dueX !== null ? (
          <span
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground/60 bg-surface"
            style={{ left: dueX }}
            title={`Prazo de produção: ${formatBr(card.due)}`}
            aria-hidden
          />
        ) : null}
        {pubX !== null ? (
          <button
            type="button"
            {...(readOnly ? {} : dragProps)}
            onClick={onOpen}
            title={`${card.title} · publica ${formatBr(preview)}${column ? ` · ${column.name}` : ''}`}
            aria-label={`${card.title}, publica em ${formatBr(preview)}`}
            className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 select-none ${
              readOnly ? '' : drag?.id === card.id ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ left: pubX, touchAction: readOnly ? undefined : 'none' }}
          >
            <span
              className={`size-3.5 rotate-45 rounded-[3px] ring-2 ring-surface ${
                late ? 'bg-danger' : SOLID[column?.color ?? 'gray']
              }`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </div>
  )
}
