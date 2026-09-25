import {
  AlignLeft,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useSearchParams } from 'react-router'
import { useConfirm } from '../components/confirmContext'
import { LabelChip } from '../components/LabelChip'
import { LabelPicker } from '../components/LabelPicker'
import { OwnerField } from '../components/OwnerField'
import { TaskDetailDialog } from '../components/TaskDetailDialog'
import { openTaskContext, OpenTaskCtx, PeopleCtx } from '../components/openTaskContext'
import { WhatsAppBadge } from '../components/WhatsAppBadge'
import { TaskNotifiedCtx, useTaskNotifications } from '../store/useTaskNotifications'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { useToast } from '../components/toastContext'
import { TEAM_FIELD_IDS } from '../data/brief'
import type { Area, Label, Phase, Task } from '../data/types'
import { storageKey } from '../lib/board'
import { formatBr, formatShort, todayIso } from '../lib/dates'
import {
  allTasks,
  checklistProgress,
  currentPhase,
  knownOwners,
  progressOf,
  useLaunchActions,
  useLaunchState,
} from '../store/launchStore'
import { isDueSoon, ownerLabel, ownerMatches } from '../store/analytics'

type Filter = 'todas' | 'pendentes' | 'avencer' | 'atrasadas' | 'concluidas'

const FILTER_LABEL: Record<Filter, string> = {
  pendentes: 'pendentes',
  avencer: 'a vencer',
  atrasadas: 'atrasadas',
  concluidas: 'concluídas',
  todas: 'todas',
}

export function ChecklistPage() {
  const [params] = useSearchParams()
  // Remonta quando a fase pedida na URL muda, para reabrir a seção certa sem setState em effect.
  return <ChecklistInner key={params.get('fase') ?? ''} />
}

function ChecklistInner() {
  const s = useLaunchState()
  const [params, setParams] = useSearchParams()
  const today = todayIso()

  const [query, setQuery] = useState('')
  const [area, setArea] = useState<string>('todas')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(() => params.get('card'))
  const notified = useTaskNotifications()
  const openTask = useMemo(() => openTaskContext(setDetailTaskId), [setDetailTaskId])
  const dragApi = useTaskDrag()
  // O padrão é ver o que falta: concluída sai da lista e fica no chip "Concluídas".
  const filter = (params.get('filtro') as Filter) || 'pendentes'
  const resp = params.get('resp')
  const clearResp = () => {
    const next = new URLSearchParams(params)
    next.delete('resp')
    setParams(next, { replace: true })
  }
  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params)
    if (f === 'pendentes') next.delete('filtro')
    else next.set('filtro', f)
    setParams(next, { replace: true })
    // "todas" é a lista inteira: abrir tudo seria ruído, então fica como está
    if (f !== 'todas') {
      const ids = phasesWith(f)
      if (ids.length) setOpen(new Set(ids))
    }
  }

  useEffect(() => {
    const fase = params.get('fase')
    if (fase) document.getElementById(`fase-${fase}`)?.scrollIntoView({ block: 'start' })
  }, [params])

  const areaNames = useMemo(() => {
    const set = new Set<string>()
    for (const p of s.phases) for (const a of p.areas) set.add(a.name)
    return [...set]
  }, [s.phases])

  const owners = useMemo(() => knownOwners(s, TEAM_FIELD_IDS), [s])
  const q = query.trim().toLowerCase()

  const matchesWith = (f: Filter) => (t: Task) => {
    if (resp && !ownerMatches(t, resp, s.people)) return false
    if (f === 'pendentes' && t.done) return false
    if (f === 'avencer' && !isDueSoon(t, today)) return false
    if (f === 'atrasadas' && (t.done || !t.due || t.due >= today)) return false
    if (f === 'concluidas' && !t.done) return false
    if (labelFilter && !t.labelIds?.includes(labelFilter)) return false
    if (
      q &&
      !t.label.toLowerCase().includes(q) &&
      !t.owner.toLowerCase().includes(q) &&
      !(t.description ?? '').toLowerCase().includes(q)
    )
      return false
    return true
  }
  const matches = matchesWith(filter)

  /** Fases com pelo menos uma tarefa que aparece no filtro (respeitando a área escolhida). */
  const phasesWith = (f: Filter): string[] => {
    const pred = matchesWith(f)
    return s.phases
      .filter((p) =>
        p.areas.some((a) => (area === 'todas' || a.name === area) && a.tasks.some(pred)),
      )
      .map((p) => p.id)
  }

  const [open, setOpen] = useState<Set<string>>(() => {
    const fase = params.get('fase')
    if (fase) return new Set([fase])
    // vindo da Analytics por responsável, todas as fases abrem para a lista aparecer inteira
    if (resp) return new Set(s.phases.map((p) => p.id))
    // vindo de um número da Analytics (atrasadas, a vencer…): abre as fases que têm o que mostrar
    if (params.get('filtro') && filter !== 'todas') {
      const ids = phasesWith(filter)
      if (ids.length) return new Set(ids)
    }
    const atual = currentPhase(s, today)?.id ?? s.phases[0]?.id
    return new Set(atual ? [atual] : [])
  })

  const total = progressOf(allTasks(s))
  // "recortada" é a lista que esconde tarefa por busca, área, etiqueta, responsável ou estado
  // que não seja o do dia a dia; aí some o que está vazio e o arrastar sai de cena.
  const filtering =
    q !== '' ||
    area !== 'todas' ||
    labelFilter !== null ||
    resp !== null ||
    (filter !== 'pendentes' && filter !== 'todas')
  // Arrastar só onde a ordem da tela é a ordem gravada: em "Todas" as concluídas vão para o fim.
  const canDrag = !filtering && filter === 'pendentes'
  const view = viewMode(filter, canDrag)
  const visibleIds = phasesWith(filter)
  const visiblePhases = s.phases.filter((p) => visibleIds.includes(p.id))
  const allOpen = open.size === s.phases.length

  return (
    <>
      <PageHeader
        kicker="Etapa 3"
        title="Checklist do lançamento"
        actions={
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setOpen(allOpen ? new Set() : new Set(s.phases.map((p) => p.id)))}
          >
            {allOpen ? (
              <ChevronsDownUp className="size-4" aria-hidden />
            ) : (
              <ChevronsUpDown className="size-4" aria-hidden />
            )}
            {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        }
      >
        Todas as tarefas por fase e por área. Marque o que está pronto, defina responsável e prazo.
        Clique no lápis para editar, ou adicione tarefas e áreas próprias.
      </PageHeader>

      {/* Barra de filtros */}
      <div className="card z-20 mb-5 grid gap-3 p-3 sm:sticky sm:top-[65px] sm:mb-6 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              className="field pl-9"
              placeholder="Buscar tarefa ou responsável"
              aria-label="Buscar tarefa ou responsável"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div role="group" aria-label="Estado" className="flex gap-1.5">
            {(['pendentes', 'avencer', 'atrasadas', 'concluidas', 'todas'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip capitalize ${filter === f ? 'chip-active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="label-mono">Área</span>
            <select className="field w-auto" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="todas">Todas as áreas</option>
              {areaNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {s.labels.length ? (
            <label className="flex items-center gap-2">
              <span className="label-mono">Etiqueta</span>
              <select
                className="field w-auto"
                value={labelFilter ?? ''}
                onChange={(e) => setLabelFilter(e.target.value || null)}
              >
                <option value="">Todas</option>
                {s.labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {resp ? (
            <span className="chip chip-active">
              Responsável: {ownerLabel(resp, s)}
              <button
                type="button"
                className="-mr-1 rounded-full p-0.5 hover:bg-secondary-foreground/20"
                aria-label="Limpar filtro de responsável"
                onClick={clearResp}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {total.done}/{total.total} concluídas
          </span>
        </div>
      </div>

      <OpenTaskCtx.Provider value={openTask}>
        <PeopleCtx.Provider value={s.people}>
          <TaskNotifiedCtx.Provider value={notified}>
            <DragCtx.Provider value={dragApi}>
              <ViewCtx.Provider value={view}>
                <div className="grid gap-4">
                  {filtering && visiblePhases.length === 0 ? (
                    <p className="card p-5 text-sm text-muted-foreground">
                      Nada para mostrar com esses filtros.
                    </p>
                  ) : null}
                  {(filtering ? visiblePhases : s.phases).map((p) => (
                    <PhaseSection
                      key={p.id}
                      phase={p}
                      open={open.has(p.id)}
                      onToggle={() =>
                        setOpen((o) => {
                          const n = new Set(o)
                          if (n.has(p.id)) n.delete(p.id)
                          else n.add(p.id)
                          return n
                        })
                      }
                      areaFilter={area}
                      matches={matches}
                      filtering={filtering}
                      owners={owners}
                      today={today}
                      labels={s.labels}
                    />
                  ))}
                </div>
              </ViewCtx.Provider>
            </DragCtx.Provider>
          </TaskNotifiedCtx.Provider>
        </PeopleCtx.Provider>
      </OpenTaskCtx.Provider>
      <TaskNotifiedCtx.Provider value={notified}>
        <TaskDetailDialog taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      </TaskNotifiedCtx.Provider>
      <datalist id="owner-suggestions">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

/** Como a lista está sendo vista agora: usado pela área (ordem, arrastar) e pela tarefa. */
interface ViewMode {
  filter: Filter
  canDrag: boolean
}
const ViewCtx = createContext<ViewMode>({ filter: 'pendentes', canDrag: false })

/** Mesmo objeto para a mesma combinação (são no máximo 10), para o contexto não mudar à toa. */
const VIEW_MODES = new Map<string, ViewMode>()
function viewMode(filter: Filter, canDrag: boolean): ViewMode {
  const key = `${filter}|${canDrag}`
  let v = VIEW_MODES.get(key)
  if (!v) {
    v = { filter, canDrag }
    VIEW_MODES.set(key, v)
  }
  return v
}

// ---------------- Fase ----------------

function PhaseSection({
  phase,
  open,
  onToggle,
  areaFilter,
  matches,
  filtering,
  today,
  labels,
}: {
  phase: Phase
  open: boolean
  onToggle: () => void
  areaFilter: string
  matches: (t: Task) => boolean
  filtering: boolean
  owners: string[]
  today: string
  labels: Label[]
}) {
  const { addArea } = useLaunchActions()
  const toast = useToast()
  const [newArea, setNewArea] = useState('')
  const [addingArea, setAddingArea] = useState(false)
  const pr = progressOf(phase.areas.flatMap((a) => a.tasks))

  const visibleAreas = phase.areas
    .filter((a) => areaFilter === 'todas' || a.name === areaFilter)
    .map((a) => ({ area: a, tasks: a.tasks.filter(matches) }))
    // sem recorte, a área continua à vista mesmo com tudo feito (ou vazia): a lista explica
    .filter((x) => x.tasks.length > 0 || !filtering)

  const hiddenByFilter = filtering && visibleAreas.length === 0

  return (
    <section id={`fase-${phase.id}`} className="card scroll-mt-40 overflow-hidden">
      <button
        type="button"
        className="block w-full px-4 py-3.5 text-left hover:bg-muted/50 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:px-6 sm:py-4"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="block font-display text-base sm:flex-1 sm:text-lg">{phase.name}</span>
        <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:gap-4">
          <span className="shrink-0 text-sm text-muted-foreground">
            {pr.done}/{pr.total}
          </span>
          <ProgressBar
            value={pr.pct}
            className="flex-1 sm:w-28 sm:flex-none"
            label={`${phase.name}: ${pr.pct}%`}
          />
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>

      {open ? (
        <div className="border-t border-border px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="label-mono">
              {formatBr(phase.start)} até {formatBr(phase.end)}
            </p>
            {!filtering ? (
              addingArea ? (
                <form
                  className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newArea.trim()) return
                    addArea(phase.id, newArea)
                    setNewArea('')
                    setAddingArea(false)
                    toast('Área criada')
                  }}
                >
                  <input
                    autoFocus
                    className="field uppercase sm:max-w-xs"
                    placeholder="Nome da área (ex.: JURÍDICO)"
                    aria-label="Nome da nova área"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setAddingArea(false)}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-secondary" disabled={!newArea.trim()}>
                      Criar área
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setAddingArea(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn-ghost ml-auto h-8 border-dashed px-2.5 py-0 text-xs"
                  onClick={() => setAddingArea(true)}
                >
                  <Plus className="size-3.5" aria-hidden /> Nova área
                </button>
              )
            ) : null}
          </div>
          {hiddenByFilter ? (
            <p className="text-sm text-muted-foreground">Nada para mostrar com esses filtros.</p>
          ) : null}
          {visibleAreas.map(({ area, tasks }) => (
            <AreaBlock key={area.id} area={area} tasks={tasks} today={today} labels={labels} />
          ))}

          {!filtering && phase.areas.length > 2 ? (
            <button
              type="button"
              className="btn-ghost mt-4 border-dashed"
              onClick={() => {
                setAddingArea(true)
                document.getElementById(`fase-${phase.id}`)?.scrollIntoView({ block: 'start' })
              }}
            >
              <Plus className="size-4" aria-hidden /> Nova área nesta fase
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

// ---------------- Área ----------------

const COLLAPSED_KEY = storageKey('gps-collapsed-areas')
function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    const arr: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}
function writeCollapsed(set: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]))
  } catch {
    // sem armazenamento local (modo privado): o recolher vale só até recarregar
  }
}

/**
 * Arrasto de uma tarefa pela página: `overAreaId` é a área sob o ponteiro (lista aberta ou cabeçalho
 * de área recolhida) e `overIndex` a posição de inserção entre as tarefas visíveis dela.
 */
interface PageDrag {
  id: string
  fromAreaId: string
  overAreaId: string | null
  overIndex: number
}
interface DragApi {
  drag: PageDrag | null
  start: (taskId: string, areaId: string, e: ReactPointerEvent<HTMLButtonElement>) => void
}
const DragCtx = createContext<DragApi>({ drag: null, start: () => {} })

/** Onde o ponteiro está: uma lista de área (com índice) ou o cabeçalho de uma área recolhida. */
function dropTargetAt(x: number, y: number): { areaId: string; index: number } | null {
  for (const ul of document.querySelectorAll<HTMLUListElement>('main ul[data-area-id]')) {
    const r = ul.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top - 12 || y > r.bottom + 12) continue
    const rows = Array.from(ul.querySelectorAll<HTMLLIElement>(':scope > li'))
    let index = rows.length
    for (let i = 0; i < rows.length; i++) {
      const rr = rows[i].getBoundingClientRect()
      if (y < rr.top + rr.height / 2) {
        index = i
        break
      }
    }
    return { areaId: ul.dataset.areaId!, index }
  }
  for (const el of document.querySelectorAll<HTMLElement>('main [data-area-drop]')) {
    const r = el.getBoundingClientRect()
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
      return { areaId: el.dataset.areaDrop!, index: Number.POSITIVE_INFINITY }
  }
  return null
}

/** Motor do arrastar e soltar: a alça inicia, a janela acompanha, soltar reordena ou muda de área. */
function useTaskDrag(): DragApi {
  const { placeTask } = useLaunchActions()
  const s = useLaunchState()
  const toast = useToast()
  const [drag, setDrag] = useState<PageDrag | null>(null)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!drag) return
    let raf = 0
    const update = () => {
      const t = dropTargetAt(last.current.x, last.current.y)
      setDrag((d) =>
        d && (d.overAreaId !== (t?.areaId ?? null) || d.overIndex !== (t?.index ?? -1))
          ? { ...d, overAreaId: t?.areaId ?? null, overIndex: t?.index ?? -1 }
          : d,
      )
    }
    const onMove = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY }
      update()
    }
    // perto da borda da janela a página rola sozinha, para alcançar outra fase
    const tick = () => {
      const y = last.current.y
      const edge = 80
      const bottom = window.innerHeight - edge
      if (y > 0 && y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 6))
      else if (y > bottom) window.scrollBy(0, Math.ceil((y - bottom) / 6))
      else {
        raf = requestAnimationFrame(tick)
        return
      }
      update()
      raf = requestAnimationFrame(tick)
    }
    const onUp = () => {
      setDrag((d) => {
        if (d && d.overAreaId) {
          const ul = document.querySelector<HTMLUListElement>(
            `main ul[data-area-id="${d.overAreaId}"]`,
          )
          const rows = ul ? Array.from(ul.querySelectorAll<HTMLLIElement>(':scope > li')) : []
          const before = rows[d.overIndex]?.dataset.taskId ?? null
          placeTask(d.id, d.overAreaId, before)
          if (d.overAreaId !== d.fromAreaId) {
            const to = s.phases.flatMap((p) => p.areas).find((a) => a.id === d.overAreaId)
            toast(to ? `Tarefa movida para ${to.name}` : 'Tarefa movida')
          }
        }
        return null
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(raf)
    }
  }, [drag, placeTask, s, toast])

  const start: DragApi['start'] = (taskId, areaId, e) => {
    if (e.button !== 0) return
    e.preventDefault()
    last.current = { x: e.clientX, y: e.clientY }
    setDrag({ id: taskId, fromAreaId: areaId, overAreaId: areaId, overIndex: -1 })
  }
  return { drag, start }
}

function AreaBlock({
  area,
  tasks,
  today,
  labels,
}: {
  area: Area
  tasks: Task[]
  today: string
  labels: Label[]
}) {
  const { addTask, setAreaDone, renameArea, removeArea } = useLaunchActions()
  const toast = useToast()
  const confirm = useConfirm()
  const [newLabel, setNewLabel] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(area.name)
  const [collapsed, setCollapsed] = useState(() => readCollapsed().has(area.id))
  const toggleCollapsed = () => {
    const set = readCollapsed()
    if (set.has(area.id)) set.delete(area.id)
    else set.add(area.id)
    writeCollapsed(set)
    setCollapsed(set.has(area.id))
  }
  const { filter, canDrag } = useContext(ViewCtx)
  const canReorder = canDrag
  // Em "Todas", o que está feito desce para o fim da área, sem mudar a ordem gravada.
  const shown = useMemo(
    () => (filter === 'todas' ? [...tasks].sort((a, b) => Number(a.done) - Number(b.done)) : tasks),
    [filter, tasks],
  )
  const allTasksDone = tasks.length === 0 && area.tasks.length > 0
  const { drag, start } = useContext(DragCtx)
  const isDropHere = !!drag && drag.overAreaId === area.id
  const requestRemove = () =>
    confirm({
      title: `Excluir a área ${area.name}?`,
      description: area.tasks.length
        ? `As ${area.tasks.length} tarefas dela serão excluídas junto. Isso não pode ser desfeito.`
        : 'A área está vazia e será removida desta fase.',
      confirmLabel: 'Excluir área',
      danger: true,
      onConfirm: () => {
        removeArea(area.id)
        toast('Área excluída')
      },
    })
  const pr = progressOf(area.tasks)
  const allDone = pr.total > 0 && pr.done === pr.total

  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {editingName ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              renameArea(area.id, nameDraft)
              setEditingName(false)
            }}
          >
            <input
              autoFocus
              className="field w-48 uppercase"
              aria-label="Nome da área"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setNameDraft(area.name)
                  setEditingName(false)
                }
              }}
            />
            <button type="submit" className="btn-secondary py-1.5">
              Salvar
            </button>
          </form>
        ) : (
          <button
            type="button"
            data-area-drop={collapsed ? area.id : undefined}
            className={`flex items-center gap-2 rounded-md py-0.5 pr-1 hover:bg-muted/50 ${
              collapsed && isDropHere ? 'ring-2 ring-primary' : ''
            }`}
            aria-expanded={!collapsed}
            title={collapsed ? 'Mostrar as tarefas desta área' : 'Recolher as tarefas desta área'}
            onClick={toggleCollapsed}
          >
            <h3 className="area-badge">{area.name}</h3>
            <span className="text-xs text-muted-foreground">
              {pr.done}/{pr.total}
            </span>
            {collapsed ? (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
            )}
          </button>
        )}
        {editingName ? (
          <span className="text-xs text-muted-foreground">
            {pr.done}/{pr.total}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="btn-ghost h-8 px-2.5 py-0 text-xs"
            disabled={pr.total === 0}
            onClick={() => setAreaDone(area.id, !allDone)}
          >
            {allDone ? 'Desmarcar todas' : 'Concluir todas'}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Renomear área ${area.name}`}
            onClick={() => {
              setNameDraft(area.name)
              setEditingName(true)
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn hover:text-danger"
            aria-label={`Excluir área ${area.name}`}
            onClick={requestRemove}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <>
          {shown.length === 0 ? (
            <p
              className={`mb-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground ${
                isDropHere ? 'border-primary text-foreground' : 'border-transparent'
              }`}
            >
              {isDropHere
                ? 'Solte aqui'
                : allTasksDone
                  ? `Tudo feito por aqui. ${pr.total} ${pr.total === 1 ? 'tarefa concluída' : 'tarefas concluídas'}.`
                  : 'Nenhuma tarefa nesta área ainda.'}
            </p>
          ) : null}
          <ul data-area-id={area.id} className="grid gap-2">
            {shown.map((t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                today={today}
                labels={labels}
                dragging={drag?.id === t.id}
                dropBefore={isDropHere && drag.overIndex === i && drag.id !== t.id}
                dropAfter={isDropHere && drag.overIndex >= shown.length && i === shown.length - 1}
                onDragStart={canReorder ? (e) => start(t.id, area.id, e) : undefined}
              />
            ))}
          </ul>
        </>
      )}

      {collapsed ? null : (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newLabel.trim()) return
            addTask(area.id, newLabel)
            setNewLabel('')
            toast('Tarefa adicionada')
          }}
        >
          <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            className="field border-dashed bg-transparent"
            placeholder={`Nova tarefa em ${area.name.toLowerCase()}`}
            aria-label={`Nova tarefa em ${area.name}`}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button type="submit" className="btn-secondary py-1.5" disabled={!newLabel.trim()}>
            Adicionar
          </button>
        </form>
      )}
    </div>
  )
}

// ---------------- Tarefa ----------------

function TaskRow({
  task,
  today,
  labels,
  dragging = false,
  dropBefore = false,
  dropAfter = false,
  onDragStart,
}: {
  task: Task
  today: string
  labels: Label[]
  dragging?: boolean
  dropBefore?: boolean
  dropAfter?: boolean
  /** presente quando a lista está sem filtro e a tarefa pode ser arrastada */
  onDragStart?: (e: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const { patchTask, removeTask } = useLaunchActions()
  const openTask = useContext(OpenTaskCtx)
  const people = useContext(PeopleCtx)
  const taskLabels = labels.filter((l) => task.labelIds?.includes(l.id))
  const cl = checklistProgress(task)
  const hasOwner = (task.ownerIds ?? (task.ownerId ? [task.ownerId] : [])).some((id) =>
    people.some((p) => p.id === id && p.phone !== ''),
  )
  const hasExtras =
    taskLabels.length > 0 || !!task.description || !!task.link || cl.total > 0 || hasOwner
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.label)
  const requestRemove = () =>
    confirm({
      title: 'Excluir esta tarefa?',
      description: `"${task.label}" será removida do checklist. Isso não pode ser desfeito.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: () => {
        removeTask(task.id)
        toast('Tarefa excluída')
      },
    })
  const late = !task.done && task.due !== '' && task.due < today
  const { filter } = useContext(ViewCtx)
  const hidesDone = filter === 'pendentes' || filter === 'atrasadas' || filter === 'avencer'

  function commitLabel() {
    const clean = draft.trim()
    if (clean && clean !== task.label) patchTask(task.id, { label: clean })
    else setDraft(task.label)
    setEditing(false)
  }

  return (
    <li
      data-task-id={task.id}
      className={`fade-in relative rounded-lg border bg-surface px-3 py-2.5 transition-colors ${
        late ? 'border-danger/50' : task.done ? 'border-border/60 bg-surface/40' : 'border-border'
      } ${dragging ? 'opacity-50 ring-2 ring-primary/60' : ''}`}
    >
      {dropBefore ? (
        <span
          className="pointer-events-none absolute inset-x-0 -top-[5px] h-0.5 rounded bg-primary"
          aria-hidden
        />
      ) : null}
      {dropAfter ? (
        <span
          className="pointer-events-none absolute inset-x-0 -bottom-[5px] h-0.5 rounded bg-primary"
          aria-hidden
        />
      ) : null}
      <div className="flex items-start gap-3 sm:items-center">
        <input
          type="checkbox"
          className="checkbox mt-0.5 sm:mt-0"
          checked={task.done}
          aria-label={`Concluir: ${task.label}`}
          onChange={(e) => {
            const done = e.target.checked
            patchTask(task.id, { done })
            // na visão do dia a dia a linha some na hora: o aviso guarda a volta
            if (done && hidesDone)
              toast(`Feito: ${task.label}`, 'ok', {
                label: 'Desfazer',
                onClick: () => patchTask(task.id, { done: false }),
              })
          }}
        />

        {editing ? (
          <input
            autoFocus
            className="field min-w-0 flex-1 py-1"
            aria-label="Nome da tarefa"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel()
              if (e.key === 'Escape') {
                setDraft(task.label)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            title="Abrir card"
            onClick={() => openTask(task.id)}
          >
            <span
              className={`text-sm leading-snug ${task.done ? 'text-muted-foreground opacity-70' : ''}`}
            >
              {task.label}
              {task.custom ? (
                <span className="ml-1.5 rounded bg-muted px-1 py-px align-middle text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  própria
                </span>
              ) : null}
            </span>
            {hasExtras ? (
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                {taskLabels.map((l) => (
                  <LabelChip key={l.id} label={l} />
                ))}
                <WhatsAppBadge task={task} people={people} />
                {task.description ? (
                  <AlignLeft
                    className="size-3.5 text-muted-foreground"
                    aria-label="Tem descrição"
                  />
                ) : null}
                {task.link ? (
                  <Link2 className="size-3.5 text-muted-foreground" aria-label="Tem link" />
                ) : null}
                {cl.total > 0 ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1 text-[11px] font-semibold ${
                      cl.done === cl.total
                        ? 'bg-lime text-lime-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <CheckSquare className="size-3.5" aria-hidden />
                    {cl.done}/{cl.total}
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
        )}

        <div className="hidden items-center gap-2 sm:flex">
          <OwnerDue task={task} late={late} patchTask={patchTask} />
          <RowActions
            task={task}
            labels={labels}
            onEdit={() => setEditing(true)}
            onRemove={requestRemove}
            onDragStart={onDragStart}
          />
        </div>
      </div>

      {/* celular: responsável + prazo, depois ações */}
      <div className="mt-2 grid gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <OwnerDue task={task} late={late} patchTask={patchTask} compact />
        </div>
        <div className="flex justify-end">
          <RowActions
            task={task}
            labels={labels}
            onEdit={() => setEditing(true)}
            onRemove={requestRemove}
            onDragStart={onDragStart}
          />
        </div>
      </div>
    </li>
  )
}

function OwnerDue({
  task,
  late,
  patchTask,
  compact,
}: {
  task: Task
  late: boolean
  patchTask: (id: string, p: Partial<Task>) => void
  compact?: boolean
}) {
  const people = useContext(PeopleCtx)
  const { setTaskOwners } = useLaunchActions()
  return (
    <>
      <OwnerField
        task={task}
        people={people}
        compact={compact}
        onChange={(patch) => patchTask(task.id, patch)}
        onChangeOwners={(ids) => setTaskOwners(task.id, ids)}
      />
      <div className="relative">
        <input
          type="date"
          aria-label={`Prazo de: ${task.label}`}
          className={`field min-w-0 py-1.5 ${compact ? 'w-[8.75rem] shrink-0' : 'w-auto'} ${late ? 'border-danger text-danger' : ''}`}
          value={task.due}
          onChange={(e) => patchTask(task.id, { due: e.target.value })}
        />
        {late ? <span className="sr-only">Atrasada desde {formatShort(task.due)}</span> : null}
      </div>
    </>
  )
}

function RowActions({
  task,
  labels,
  onEdit,
  onRemove,
  onDragStart,
}: {
  task: Task
  labels: Label[]
  onEdit: () => void
  onRemove: () => void
  onDragStart?: (e: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="flex shrink-0 items-center">
      <LabelPicker task={task} labels={labels} variant="icon" align="right" />
      {onDragStart ? (
        <button
          type="button"
          className="icon-btn cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Arrastar para reordenar: ${task.label}`}
          title="Arraste para reordenar"
          onPointerDown={onDragStart}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="icon-btn"
        aria-label={`Editar tarefa: ${task.label}`}
        onClick={onEdit}
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn hover:text-danger"
        aria-label={`Excluir tarefa: ${task.label}`}
        onClick={onRemove}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
