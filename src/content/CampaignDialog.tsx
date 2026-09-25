import { Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useConfirm } from '../components/confirmContext'
import { LABEL_COLOR_NAMES } from '../data/labels'
import type { LabelColor } from '../data/types'
import { newId } from '../store/launchStore'
import type { Campaign } from './model'
import { useContentActions } from './useContent'
import { SOLID } from './visual'

const COLORS: LabelColor[] = ['pink', 'blue', 'aqua', 'lime', 'black', 'gray']

/** Criar ou editar campanha: nome, cor, período e objetivo. `campaign === null` fecha. */
export function CampaignDialog({
  campaign,
  onClose,
}: {
  campaign: Campaign | 'new' | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (campaign && !d.open) d.showModal()
    if (!campaign && d.open) d.close()
  }, [campaign])
  return (
    <dialog
      ref={ref}
      aria-label="Campanha"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl"
    >
      {campaign ? (
        <Form
          key={campaign === 'new' ? 'new' : campaign.id}
          campaign={campaign}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  )
}

function Form({ campaign, onClose }: { campaign: Campaign | 'new'; onClose: () => void }) {
  const a = useContentActions()
  const confirm = useConfirm()
  const isNew = campaign === 'new'
  const [draft, setDraft] = useState<Campaign>(
    isNew
      ? { id: newId('cp'), name: '', color: 'pink', start: '', end: '', objective: '', notes: '' }
      : campaign,
  )
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))
  const datesOk = !draft.start || !draft.end || draft.end >= draft.start
  const valid = draft.name.trim() !== '' && datesOk

  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        a.saveCampaign({ ...draft, name: draft.name.trim().slice(0, 120) })
        onClose()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">{isNew ? 'Nova campanha' : 'Editar campanha'}</h2>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="label-mono">Nome</span>
        <input
          autoFocus
          className="field"
          placeholder="Ex.: Lançamento do livro, Black Friday"
          maxLength={120}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="label-mono">Cor</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={LABEL_COLOR_NAMES[c]}
              aria-pressed={draft.color === c}
              onClick={() => set('color', c)}
              className={`size-8 rounded-lg ${SOLID[c]} ${draft.color === c ? 'ring-2 ring-ring ring-offset-2 ring-offset-surface' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Início</span>
          <input
            type="date"
            className="field"
            value={draft.start}
            onChange={(e) => set('start', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label-mono">Fim</span>
          <input
            type="date"
            className={`field ${datesOk ? '' : 'border-danger'}`}
            value={draft.end}
            onChange={(e) => set('end', e.target.value)}
          />
        </label>
      </div>
      {!datesOk ? <p className="-mt-2 text-xs text-danger">O fim vem depois do início.</p> : null}
      <label className="flex flex-col gap-1.5">
        <span className="label-mono">Objetivo</span>
        <input
          className="field"
          placeholder="Ex.: 300 pré-vendas do livro"
          maxLength={600}
          value={draft.objective}
          onChange={(e) => set('objective', e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label-mono">Notas</span>
        <textarea
          className="field min-h-20"
          placeholder="Mensagem central, oferta, datas importantes"
          maxLength={8000}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {!isNew ? (
          <button
            type="button"
            className="btn-danger"
            onClick={() =>
              confirm({
                title: `Excluir a campanha ${draft.name}?`,
                description: 'Os cards dela continuam no quadro, só ficam sem campanha.',
                confirmLabel: 'Excluir',
                danger: true,
                onConfirm: () => {
                  a.deleteCampaign(draft.id)
                  onClose()
                },
              })
            }
          >
            <Trash2 className="size-4" aria-hidden /> Excluir
          </button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={!valid}>
            {isNew ? 'Criar campanha' : 'Salvar'}
          </button>
        </div>
      </div>
    </form>
  )
}
