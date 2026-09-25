import { Target, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '../components/toastContext'
import { useLaunchState } from '../store/launchStore'
import { FORMATS, FORMAT_LABEL, type CadenceGoal, type ContentFormat } from './model'
import { contentOf, useContentActions } from './useContent'
import { FORMAT_ICON } from './visual'

/**
 * Meta de publicações por semana, por formato. É a mesma cadência da Estratégia (uma fonte só):
 * o calendário compara com o planejado, o Analytics com o publicado de verdade.
 */
export function GoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label="Meta de publicações"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl"
    >
      {open ? <Form onClose={onClose} /> : null}
    </dialog>
  )
}

function Form({ onClose }: { onClose: () => void }) {
  const s = useLaunchState()
  const cadence = contentOf(s).strategy.cadence
  const { updateStrategy } = useContentActions()
  const toast = useToast()
  const [draft, setDraft] = useState<Record<ContentFormat, string>>(
    () =>
      Object.fromEntries(
        FORMATS.map((f) => [f, String(cadence.find((c) => c.format === f)?.perWeek || '')]),
      ) as Record<ContentFormat, string>,
  )
  const weekly = FORMATS.reduce((a, f) => a + (Number(draft[f]) || 0), 0)

  return (
    <form
      className="flex flex-col gap-5 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault()
        const next: CadenceGoal[] = FORMATS.map((f) => ({
          format: f,
          perWeek: Math.min(70, Number(draft[f]) || 0),
        })).filter((g) => g.perWeek > 0)
        updateStrategy({ cadence: next }, 'Cadência')
        toast(weekly ? `Meta salva: ${weekly} posts por semana` : 'Meta removida')
        onClose()
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono flex items-center gap-1.5">
            <Target className="size-3.5" aria-hidden /> Meta
          </p>
          <h2 className="mt-1 text-2xl">Posts por semana</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quantos posts de cada formato precisam sair por semana. A porcentagem do Analytics conta
            só o que foi para Publicado.
          </p>
        </div>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {FORMATS.map((f) => {
          const Icon = FORMAT_ICON[f]
          return (
            <li key={f}>
              <label className="flex flex-col gap-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5 transition-colors focus-within:border-primary">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden /> {FORMAT_LABEL[f]}
                </span>
                <input
                  inputMode="numeric"
                  className="w-full bg-transparent font-display text-3xl font-extrabold tabular-nums tracking-[-0.03em] outline-none placeholder:text-muted-foreground/30"
                  placeholder="0"
                  aria-label={`Meta semanal de ${FORMAT_LABEL[f]}`}
                  value={draft[f]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f]: e.target.value.replace(/\D/g, '').slice(0, 2) }))
                  }
                />
              </label>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <span>
          <strong className="font-display text-xl tabular-nums">{weekly}</strong>{' '}
          <span className="text-muted-foreground">por semana</span>
        </span>
        <span className="text-muted-foreground">
          ≈{' '}
          <strong className="text-foreground tabular-nums">{Math.round((weekly * 30) / 7)}</strong>{' '}
          por mês ·{' '}
          <strong className="text-foreground tabular-nums">
            {(weekly / 7).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          </strong>{' '}
          por dia
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary">
          Salvar meta
        </button>
      </div>
    </form>
  )
}
