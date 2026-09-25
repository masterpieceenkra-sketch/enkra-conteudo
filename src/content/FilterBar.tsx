import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Label, Person } from '../data/types'
import {
  EMPTY_FILTER,
  FORMATS,
  FORMAT_LABEL,
  NETWORKS,
  NETWORK_LABEL,
  type CardFilter,
  type ContentState,
} from './model'

interface Props {
  value: CardFilter
  onChange: (f: CardFilter) => void
  content: ContentState
  labels: Label[]
  people: Person[]
}

type Key = Exclude<keyof CardFilter, 'q'>

/**
 * Busca sempre à vista; o resto dos filtros num painel só, atrás de um botão com contador.
 * Filtro ativo vira chip removível ao lado da busca, para ninguém esquecer que tem filtro ligado.
 */
export function FilterBar({ value, onChange, content, labels, people }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const set = <K extends keyof CardFilter>(k: K, v: CardFilter[K]) => onChange({ ...value, [k]: v })
  const pillars = content.strategy.pillars.filter((p) => p.name.trim())

  const groups: { key: Key; title: string; options: { value: string; label: string }[] }[] = [
    {
      key: 'campaignId',
      title: 'Campanha',
      options: content.campaigns.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'format',
      title: 'Formato',
      options: FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] })),
    },
    {
      key: 'network',
      title: 'Rede',
      options: NETWORKS.map((n) => ({ value: n, label: NETWORK_LABEL[n] })),
    },
    {
      key: 'ownerId',
      title: 'Responsável',
      options: people.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      key: 'labelId',
      title: 'Etiqueta',
      options: labels.map((l) => ({ value: l.id, label: l.name })),
    },
    {
      key: 'pillarId',
      title: 'Pilar',
      options: pillars.map((p) => ({ value: p.id, label: p.name })),
    },
  ].filter((g) => g.options.length > 0) as {
    key: Key
    title: string
    options: { value: string; label: string }[]
  }[]

  const active = groups
    .filter((g) => value[g.key] !== '')
    .map((g) => ({
      key: g.key,
      title: g.title,
      label: g.options.find((o) => o.value === value[g.key])?.label ?? '',
    }))

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
    <div className="flex flex-wrap items-center gap-2" role="search">
      <label className="relative min-w-0 flex-1 sm:max-w-72 sm:flex-none sm:basis-72">
        <span className="sr-only">Buscar card</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          className="field h-9 py-0 pl-8 text-sm"
          placeholder="Buscar título, roteiro, legenda"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
        />
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((o) => !o)}
          className={`btn-ghost h-9 px-3 py-0 text-sm ${active.length ? 'border-foreground/60' : ''}`}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {active.length ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {active.length}
            </span>
          ) : null}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label="Filtros"
            className="fade-in absolute left-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:left-auto sm:right-0"
          >
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="label-mono mb-1.5">{g.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => {
                      const on = value[g.key] === o.value
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set(g.key, (on ? '' : o.value) as CardFilter[Key])}
                          className={`chip ${on ? 'chip-active' : ''}`}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={!active.length}
                onClick={() => onChange({ ...EMPTY_FILTER, q: value.q })}
              >
                Limpar filtros
              </button>
              <button
                type="button"
                className="btn-secondary h-8 px-3 py-0 text-xs"
                onClick={() => setOpen(false)}
              >
                Pronto
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {active.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => set(a.key, '' as CardFilter[Key])}
          className="inline-flex h-7 max-w-52 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground transition-opacity hover:opacity-85"
          aria-label={`Tirar filtro ${a.title}: ${a.label}`}
        >
          <span className="truncate">
            <span className="opacity-60">{a.title}:</span> {a.label}
          </span>
          <X className="size-3 shrink-0" aria-hidden />
        </button>
      ))}
    </div>
  )
}
