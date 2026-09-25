import { Check, ListChecks, Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Meeting } from '../data/types'
import type { IsoDate } from '../lib/dates'
import { useLaunchActions, useLaunchState } from '../store/launchStore'
import { parseActionItems } from '../store/actionItems'
import { extractTasks, resolveProposal, type Proposal } from '../store/taskProposals'
import { useToast } from './toastContext'
import { useProfile } from './useActor'

type Row = Proposal & { createdId?: string }

/**
 * "Identificar tarefas" no resumo da reunião: a IA propõe cards, a pessoa ajusta fase, área,
 * responsável e prazo, e aceita um a um (ou todos). Nada é criado antes do aceite.
 */
export function TaskProposals({ meeting, today }: { meeting: Meeting; today: IsoDate }) {
  const s = useLaunchState()
  const { addArea, addTask, patchTask, addChecklist, addChecklistItem } = useLaunchActions()
  const profile = useProfile()
  const toast = useToast()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const [mode, setMode] = useState<'local' | 'ai'>('local')

  /** Lê o bloco "Itens de Ação" da ata na hora, sem IA. */
  function readActionItems() {
    setError(null)
    const list = parseActionItems(meeting.summary ?? '', meeting.date)
      .map((raw, i) => resolveProposal(raw, i, s, meeting, today))
      .filter((p): p is Proposal => p !== null)
    setMode('local')
    setRows(list)
    setStatus('done')
    if (!list.length)
      setError(
        'Não achei um bloco "Itens de Ação" ou "Próximos Passos" no resumo. Confira o texto ou use a IA.',
      )
  }

  async function identify() {
    setStatus('loading')
    setError(null)
    try {
      const r = await extractTasks(meeting, s, today, profile)
      const list = r.proposals
        .map((raw, i) => resolveProposal(raw, i, s, meeting, today))
        .filter((p): p is Proposal => p !== null)
      setMode('ai')
      setRows(list)
      setStatus('done')
      if (!list.length) toast('A IA não encontrou tarefas nesse resumo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível identificar tarefas')
      setStatus(rows.length ? 'done' : 'idle')
    }
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  /** Áreas criadas ("new:NOME" por fase → id), para "Aceitar todas" não duplicar. */
  const created = useRef(new Map<string, string>())
  function accept(row: Row): string {
    let areaId = row.areaId
    if (areaId.startsWith('new:')) {
      const k = `${row.phaseId}|${areaId}`
      areaId = created.current.get(k) ?? addArea(row.phaseId, areaId.slice(4))
      created.current.set(k, areaId)
      const pending = row.areaId
      setRows((cur) =>
        cur.map((r) => (r.areaId === pending && r.phaseId === row.phaseId ? { ...r, areaId } : r)),
      )
    }
    if (!areaId) return ''
    const id = addTask(areaId, row.title)
    if (!id) return ''
    const patch: Parameters<typeof patchTask>[1] = {}
    if (row.description) patch.description = row.description
    if (row.due) patch.due = row.due
    if (row.ownerName) {
      patch.owner = row.ownerName
      if (row.ownerId) patch.ownerId = row.ownerId
    }
    if (Object.keys(patch).length) patchTask(id, patch)
    if (row.checklist.length) {
      const cid = addChecklist(id, 'Passos')
      for (const item of row.checklist) addChecklistItem(id, cid, item)
    }
    update(row.key, { createdId: id })
    return id
  }

  const pending = rows.filter((r) => !r.createdId)

  if (status === 'idle' || (status === 'done' && !rows.length)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={readActionItems}>
          <ListChecks className="size-4" aria-hidden /> Identificar tarefas
        </button>
        <button type="button" className="btn-ghost" onClick={identify} title="Usa IA (OpenRouter)">
          <Sparkles className="size-4" aria-hidden /> Com IA
        </button>
        <span className="w-full text-xs text-muted-foreground">
          Lê o bloco "Itens de Ação & Próximos Passos" do resumo (nome, tarefa e data) e propõe os
          cards. Você revisa e aceita um a um. "Com IA" lê a ata inteira.
        </span>
        {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
      </div>
    )
  }
  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Sparkles className="size-4 animate-pulse" aria-hidden /> Lendo o resumo e separando as
        tarefas…
      </p>
    )
  }

  return (
    <div className="grid gap-3" aria-live="polite">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {rows.length === 0
            ? 'Nenhuma tarefa identificada.'
            : `${rows.length} ${rows.length === 1 ? 'tarefa identificada' : 'tarefas identificadas'}`}
          {rows.length && pending.length === 0 ? ' · todas criadas' : ''}
          <span className="ml-1 font-normal text-muted-foreground">
            {mode === 'ai' ? '(com IA)' : '(do bloco de itens de ação)'}
          </span>
        </p>
        <div className="ml-auto flex gap-2">
          {pending.length > 1 ? (
            <button
              type="button"
              className="btn-primary h-8 px-3 py-0 text-xs"
              onClick={() => {
                let n = 0
                for (const r of pending) if (accept(r)) n++
                toast(`${n} cards criados`)
              }}
            >
              <Check className="size-3.5" aria-hidden /> Aceitar todas ({pending.length})
            </button>
          ) : null}
          {mode === 'local' ? (
            <button
              type="button"
              className="btn-ghost h-8 px-3 py-0 text-xs"
              onClick={identify}
              title="Lê a ata inteira com IA (OpenRouter)"
            >
              <Sparkles className="size-3.5" aria-hidden /> Tentar com IA
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost h-8 px-3 py-0 text-xs"
              onClick={readActionItems}
              title="Volta para a leitura do bloco de itens de ação, sem IA"
            >
              <ListChecks className="size-3.5" aria-hidden /> Sem IA
            </button>
          )}
        </div>
      </div>
      <ol className="grid gap-2">
        {rows.map((r) => {
          const phase = s.phases.find((p) => p.id === r.phaseId)
          const newArea = r.areaId.startsWith('new:') ? r.areaId.slice(4) : null
          const ownerValue = r.ownerId ? `p:${r.ownerId}` : r.ownerName ? 'text' : ''
          if (r.createdId) {
            return (
              <li
                key={r.key}
                className="flex items-center gap-2 rounded-lg border border-lime/50 bg-lime/10 px-3 py-2 text-sm"
              >
                <Check className="size-4 shrink-0 text-lime-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <Link
                  to={`/checklist?card=${r.createdId}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Abrir card
                </Link>
              </li>
            )
          }
          return (
            <li key={r.key} className="grid gap-2 rounded-lg border border-border bg-surface-2 p-3">
              <input
                className="field font-semibold"
                aria-label="Título do card"
                value={r.title}
                maxLength={120}
                onChange={(e) => update(r.key, { title: e.target.value })}
              />
              {r.description ? (
                <p className="text-xs text-muted-foreground">{r.description}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className="label-mono">Fase</span>
                  <select
                    className="field"
                    value={r.phaseId}
                    onChange={(e) => {
                      const ph = s.phases.find((p) => p.id === e.target.value)
                      const sameName = newArea
                        ? ph?.areas.find((a) => a.name === newArea)
                        : ph?.areas.find(
                            (a) => a.name === phase?.areas.find((x) => x.id === r.areaId)?.name,
                          )
                      update(r.key, {
                        phaseId: e.target.value,
                        areaId: sameName?.id ?? (newArea ? r.areaId : (ph?.areas[0]?.id ?? '')),
                      })
                    }}
                  >
                    {s.phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label-mono">Área</span>
                  <select
                    className="field"
                    value={r.areaId}
                    onChange={(e) => update(r.key, { areaId: e.target.value })}
                  >
                    {newArea ? <option value={r.areaId}>Criar área “{newArea}”</option> : null}
                    {phase?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label-mono">Responsável</span>
                  <select
                    className="field"
                    value={ownerValue}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') update(r.key, { ownerName: '', ownerId: '' })
                      else if (v === 'text') update(r.key, { ownerId: '' })
                      else {
                        const p = s.people.find((x) => x.id === v.slice(2))
                        if (p) update(r.key, { ownerName: p.name, ownerId: p.id })
                      }
                    }}
                  >
                    <option value="">Sem responsável</option>
                    {r.ownerName && !r.ownerId ? (
                      <option value="text">{r.ownerName} (fora do cadastro)</option>
                    ) : null}
                    {s.people.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="label-mono">Prazo</span>
                  <input
                    type="date"
                    className="field"
                    value={r.due}
                    onChange={(e) => update(r.key, { due: e.target.value })}
                  />
                </label>
              </div>
              {r.checklist.length ? (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    Checklist: {r.checklist.slice(0, 4).join(' · ')}
                    {r.checklist.length > 4 ? ` · +${r.checklist.length - 4}` : ''}
                  </span>
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost h-8 px-3 py-0 text-xs hover:text-danger"
                  onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}
                >
                  <Trash2 className="size-3.5" aria-hidden /> Descartar
                </button>
                <button
                  type="button"
                  className="btn-primary h-8 px-3 py-0 text-xs"
                  disabled={!r.title.trim() || !r.areaId}
                  onClick={() => {
                    if (accept(r)) toast(`Card criado: ${r.title}`)
                  }}
                >
                  <Check className="size-3.5" aria-hidden /> Aceitar
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
