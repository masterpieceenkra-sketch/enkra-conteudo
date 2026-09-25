import { Ban, Check, Pencil, Plus, ShieldCheck, ThumbsUp, Trash2, Wallet, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Bars } from '../components/charts/Bars'
import { Donut } from '../components/charts/Donut'
import { StatCard } from '../components/charts/StatCard'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'
import { useIsAdmin, useIsFinance } from '../components/useActor'
import { phaseColor } from '../data/phaseColors'
import { formatBr, todayIso } from '../lib/dates'
import { useLaunchState } from '../store/launchStore'
import {
  byCategory,
  counted,
  decideCost,
  formatBRL,
  formatShortBRL,
  FREQUENCIES,
  FREQUENCY_LABEL,
  monthlySeries,
  monthOf,
  parseAmount,
  recurringPerMonth,
  removeCost,
  requests,
  saveCost,
  STATUS_LABEL,
  useCosts,
  type Cost,
  type CostStatus,
  type Frequency,
} from '../store/costs'

const CATEGORIAS = [
  'Tráfego',
  'Ferramentas',
  'Equipe',
  'Conteúdo',
  'Estrutura',
  'Impostos',
  'Outros',
]

interface Draft {
  id?: string
  status?: CostStatus
  name: string
  amount: string
  frequency: Frequency
  category: string
  notes: string
  paid_by: string
  spent_on: string
}

const emptyDraft = (): Draft => ({
  name: '',
  amount: '',
  frequency: 'unica',
  category: '',
  notes: '',
  paid_by: '',
  spent_on: todayIso(),
})

function shortDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Quem pediu e quando: é o que identifica a solicitação. */
function requestedBy(c: Cost): string {
  const quem = c.created_by ? `Solicitado por ${c.created_by}` : 'Solicitado'
  return `${quem} em ${shortDateTime(c.created_at)}`
}

interface LinhaProps {
  c: Cost
  isFinance: boolean
  deciding: boolean
  rejecting: string | null
  note: string
  setNote: (v: string) => void
  setRejecting: (id: string | null) => void
  onEdit: (c: Cost) => void
  onRemove: (c: Cost) => void
  onDecide: (c: Cost, status: CostStatus, motivo: string) => void
}

/** Uma linha, usada nas duas listas. Fica fora do componente para o campo não perder o foco. */
function Linha({
  c,
  isFinance,
  deciding,
  rejecting,
  note,
  setNote,
  setRejecting,
  onEdit,
  onRemove,
  onDecide,
}: LinhaProps) {
  const faltaPagador = c.status === 'aprovado' && !c.paid_by.trim()
  return (
    <li
      className={`card p-3 sm:p-4 ${c.status === 'reprovado' ? 'opacity-70' : ''} ${
        c.status === 'pendente' ? 'border-lime/60' : ''
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className={c.status === 'reprovado' ? 'line-through' : ''}>{c.name}</span>
            {c.status !== 'aprovado' ? (
              <span
                className={`rounded-sm px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] ${
                  c.status === 'reprovado'
                    ? 'bg-danger text-danger-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {STATUS_LABEL[c.status]}
              </span>
            ) : null}
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
              {FREQUENCY_LABEL[c.frequency]}
            </span>
            {c.category ? (
              <span className="rounded-sm bg-primary px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                {c.category}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBr(c.spent_on)} · {requestedBy(c)}
            {c.status === 'aprovado' && c.paid_by ? ` · pago por ${c.paid_by}` : ''}
          </p>
          {c.notes ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>
          ) : null}
          {c.status !== 'pendente' && c.decided_by ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {c.status === 'aprovado' ? 'Aprovado' : 'Reprovado'} por {c.decided_by}
              {c.decided_at ? ` em ${shortDateTime(c.decided_at)}` : ''}
              {c.decision_note ? (
                <>
                  {' · '}
                  <span className="text-foreground">{c.decision_note}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {faltaPagador ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              onClick={() => onEdit(c)}
            >
              <Wallet className="size-3.5" aria-hidden /> Falta informar quem pagou
            </button>
          ) : null}
        </div>
        <p className="font-display text-lg tabular-nums">{formatBRL(c.amount_cents)}</p>
        {isFinance && c.status !== 'aprovado' ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="chip"
              disabled={deciding}
              onClick={() => onDecide(c, 'aprovado', '')}
            >
              <ThumbsUp className="size-3.5" aria-hidden /> Aprovar
            </button>
            {c.status !== 'reprovado' ? (
              <button
                type="button"
                className="chip"
                disabled={deciding}
                onClick={() => {
                  setRejecting(rejecting === c.id ? null : c.id)
                  setNote('')
                }}
              >
                <Ban className="size-3.5" aria-hidden /> Reprovar
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Editar ${c.name}`}
            onClick={() => onEdit(c)}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn hover:text-danger"
            aria-label={`Apagar ${c.name}`}
            onClick={() => onRemove(c)}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {rejecting === c.id ? (
        <form
          className="fade-in mt-3 grid gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim() && !deciding) onDecide(c, 'reprovado', note)
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="label-mono">Por que está reprovando?</span>
            <textarea
              autoFocus
              className="field min-h-16 resize-y"
              placeholder="Ex.: valor acima do combinado, refazer orçamento."
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setRejecting(null)
                setNote('')
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!note.trim() || deciding}>
              <Ban className="size-4" aria-hidden /> Confirmar reprovação
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            A justificativa vai no WhatsApp de quem solicitou.
          </p>
        </form>
      ) : null}
    </li>
  )
}

/**
 * Custos em dois tempos: a solicitação entra na fila, o financeiro aprova ou reprova, e só o
 * aprovado vira custo lançado (aí sim com quem pagou) e entra nas contas. Só admin abre a tela.
 */
export function CostsPage() {
  const isAdmin = useIsAdmin()
  const isFinance = useIsFinance()
  const { costs, loading, error, reload } = useCosts()
  const state = useLaunchState()
  const toast = useToast()
  const confirm = useConfirm()
  const today = todayIso()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [deciding, setDeciding] = useState(false)

  const lancados = useMemo(() => counted(costs), [costs])
  const fila = useMemo(() => requests(costs), [costs])
  const pendentes = fila.filter((c) => c.status === 'pendente').length
  const series = useMemo(() => monthlySeries(costs, today), [costs, today])
  const categories = useMemo(() => byCategory(costs, today), [costs, today])
  const totalPeriodo = series.reduce((a, p) => a + p.total, 0)
  const mesAtual = series.at(-1)?.total ?? 0
  const porMes = recurringPerMonth(costs)
  const semPagador = lancados.filter((c) => !c.paid_by.trim()).length
  const amountCents = parseAmount(draft.amount)
  const valid = draft.name.trim() !== '' && amountCents > 0 && draft.spent_on !== ''
  const editandoLancado = draft.status === 'aprovado'
  const linha = {
    isFinance,
    deciding,
    rejecting,
    note,
    setNote,
    setRejecting,
    onEdit: edit,
    onRemove: askRemove,
    onDecide: (c: Cost, status: CostStatus, motivo: string) => void decide(c, status, motivo),
  }

  async function submit() {
    setBusy(true)
    setFormError(null)
    try {
      await saveCost({
        id: draft.id,
        name: draft.name,
        amount_cents: amountCents,
        frequency: draft.frequency,
        category: draft.category,
        notes: draft.notes,
        paid_by: draft.paid_by,
        spent_on: draft.spent_on,
      })
      toast(draft.id ? 'Custo atualizado' : 'Solicitação enviada para aprovação')
      setDraft(emptyDraft())
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não consegui salvar')
    } finally {
      setBusy(false)
    }
  }

  function edit(c: Cost) {
    setDraft({
      id: c.id,
      status: c.status,
      name: c.name,
      amount: (c.amount_cents / 100).toFixed(2).replace('.', ','),
      frequency: c.frequency,
      category: c.category,
      notes: c.notes,
      paid_by: c.paid_by,
      spent_on: c.spent_on,
    })
    document.getElementById('form-custo')?.scrollIntoView({ block: 'center' })
  }

  async function decide(c: Cost, status: CostStatus, motivo: string) {
    setDeciding(true)
    try {
      await decideCost(c.id, status, motivo)
      toast(status === 'aprovado' ? 'Aprovado: já é custo lançado' : 'Solicitação reprovada')
      setRejecting(null)
      setNote('')
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui registrar a decisão', 'error')
    } finally {
      setDeciding(false)
    }
  }

  function askRemove(c: Cost) {
    confirm({
      title: c.status === 'aprovado' ? 'Apagar este custo?' : 'Apagar esta solicitação?',
      description: `"${c.name}" (${formatBRL(c.amount_cents)}) sai da lista e das contas. Não dá para desfazer.`,
      confirmLabel: 'Apagar',
      danger: true,
      onConfirm: () => {
        void removeCost(c.id)
          .then(() => {
            toast('Apagado')
            reload()
          })
          .catch((e: unknown) => toast(e instanceof Error ? e.message : 'Falhou', 'error'))
      },
    })
  }

  if (!isAdmin)
    return (
      <>
        <PageHeader kicker="Dinheiro" title="Custos">
          Esta tela é só para quem administra o painel.
        </PageHeader>
        <div className="card mt-5 flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <ShieldCheck className="size-5" aria-hidden /> Os custos do lançamento ficam visíveis
          apenas para admins.
        </div>
      </>
    )

  return (
    <>
      <PageHeader kicker="Dinheiro" title="Custos">
        A solicitação entra na fila, o financeiro aprova ou reprova, e só o aprovado vira custo
        lançado e entra nas contas. Só admins veem esta tela.
      </PageHeader>

      {error ? (
        <p className="card mt-5 p-5 text-sm text-danger" role="alert">
          Não consegui carregar os custos: {error}
        </p>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Resumo dos custos lançados">
        <StatCard
          tone="hero"
          label="Total no período"
          value={formatBRL(totalPeriodo)}
          hint={
            series.length
              ? `${series.length} ${series.length === 1 ? 'mês' : 'meses'}, até ${series.at(-1)?.label}`
              : 'Nenhum custo aprovado ainda'
          }
        />
        <StatCard
          label="Este mês"
          value={formatBRL(mesAtual)}
          hint={`Aprovados que caem em ${monthOf(today).split('-').reverse().join('/')}`}
        />
        <StatCard
          label="Recorrente por mês"
          value={formatBRL(porMes)}
          hint="Média do que se repete (única fica de fora)"
        />
      </section>

      <section className="mt-5 grid gap-5 sm:mt-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="card p-4 sm:p-6">
          <h2 className="text-xl">Para onde vai</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Proporção por categoria, no peso mensal de cada custo lançado.
          </p>
          <div className="mt-4">
            <Donut
              title="Proporção dos custos por categoria"
              segments={categories.map((c, i) => ({
                key: c.key,
                label: `${c.label} · ${formatBRL(c.total)}`,
                value: c.total,
                color: phaseColor(i + 1).bg,
              }))}
              centerValue={formatShortBRL(categories.reduce((a, c) => a + c.total, 0))}
              centerLabel="por mês"
            />
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <h2 className="text-xl">Mês a mês</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O que caiu em cada mês: gasto único no mês dele, recorrente repetindo.
          </p>
          <div className="mt-4">
            <Bars
              title="Custos mês a mês"
              emptyMessage="Nenhum custo aprovado ainda."
              points={series.map((p) => ({
                key: p.month,
                label: p.label,
                value: p.total,
                display: formatBRL(p.total),
                highlight: p.month === monthOf(today),
              }))}
            />
          </div>
        </div>
      </section>

      {/* Solicitar / editar */}
      <form
        id="form-custo"
        className="card mt-5 grid gap-3 p-4 sm:mt-6 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) void submit()
        }}
      >
        <h2 className="text-xl">
          {!draft.id
            ? 'Solicitar custo'
            : editandoLancado
              ? 'Editar custo lançado'
              : 'Editar solicitação'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="label-mono">Custo</span>
            <input
              className="field"
              placeholder="Ex.: Tráfego Meta Ads"
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Valor (R$)</span>
            <input
              className="field tabular-nums"
              inputMode="decimal"
              placeholder="1.500,00"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Frequência</span>
            <select
              className="field"
              value={draft.frequency}
              onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Categoria</span>
            <input
              className="field"
              list="categorias-custo"
              placeholder="Tráfego"
              maxLength={40}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono">
              {draft.frequency === 'unica' ? 'Data do gasto' : 'Começa em'}
            </span>
            <input
              type="date"
              className="field"
              value={draft.spent_on}
              onChange={(e) => setDraft({ ...draft, spent_on: e.target.value })}
            />
          </label>
          {editandoLancado ? (
            <label className="flex flex-col gap-1 lg:col-span-2">
              <span className="label-mono">Quem pagou</span>
              <input
                className="field"
                list="pagadores"
                placeholder="Nome de quem pagou"
                maxLength={80}
                value={draft.paid_by}
                onChange={(e) => setDraft({ ...draft, paid_by: e.target.value })}
              />
            </label>
          ) : null}
        </div>
        <label className="flex flex-col gap-1">
          <span className="label-mono">Observações</span>
          <textarea
            className="field min-h-20 resize-y"
            placeholder="Contexto, número da nota, combinado de pagamento…"
            maxLength={1000}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        {editandoLancado ? (
          <p className="text-xs text-muted-foreground">
            Informar quem pagou, categoria ou observação mantém o custo aprovado. Mudar nome, valor,
            frequência ou data devolve para a fila de aprovação.
          </p>
        ) : null}
        {formError ? (
          <p className="text-sm text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {draft.id ? (
            <button type="button" className="btn-ghost" onClick={() => setDraft(emptyDraft())}>
              <X className="size-4" aria-hidden /> Cancelar edição
            </button>
          ) : null}
          <button type="submit" className="btn-primary" disabled={!valid || busy}>
            {draft.id ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Plus className="size-4" aria-hidden />
            )}
            {busy ? 'Salvando…' : draft.id ? 'Salvar alterações' : 'Enviar solicitação'}
          </button>
        </div>
        <datalist id="categorias-custo">
          {[...new Set([...categories.map((c) => c.key), ...CATEGORIAS])].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="pagadores">
          {[...new Set([...state.people.map((p) => p.name), ...costs.map((c) => c.paid_by)])]
            .filter(Boolean)
            .map((n) => (
              <option key={n} value={n} />
            ))}
        </datalist>
      </form>

      {/* Solicitações */}
      <section className="mt-5 sm:mt-6" aria-label="Solicitações de custo">
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl">Solicitações</h2>
          <span className="text-sm text-muted-foreground">
            {pendentes ? `${pendentes} aguardando decisão` : 'nada aguardando decisão'}
            {fila.length - pendentes > 0 ? ` · ${fila.length - pendentes} reprovadas` : ''}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : fila.length === 0 ? (
          <div className="card p-5 text-sm text-muted-foreground">
            Nenhuma solicitação na fila. Use o formulário acima para pedir um custo novo.
          </div>
        ) : (
          <ul className="grid gap-2">
            {fila.map((c) => (
              <Linha key={c.id} c={c} {...linha} />
            ))}
          </ul>
        )}
      </section>

      {/* Custos lançados */}
      <section className="mt-5 sm:mt-6" aria-label="Custos lançados">
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl">Custos lançados</h2>
          <span className="text-sm text-muted-foreground">
            {lancados.length} {lancados.length === 1 ? 'custo aprovado' : 'custos aprovados'}
            {semPagador ? ` · ${semPagador} sem quem pagou` : ''}
          </span>
        </div>
        {loading ? null : lancados.length === 0 ? (
          <div className="card p-5 text-sm text-muted-foreground">
            Nada lançado ainda. Assim que o financeiro aprovar uma solicitação, ela aparece aqui.
          </div>
        ) : (
          <ul className="grid gap-2">
            {lancados.map((c) => (
              <Linha key={c.id} c={c} {...linha} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
