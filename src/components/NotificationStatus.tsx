import { BellRing, ChevronDown, ChevronUp, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { OVERDUE_EVERY_OPTIONS, OVERDUE_HOUR_OPTIONS, type NotificationPrefs } from '../data/types'
import { LAUNCH_ID, SYNC_ENABLED, supabase } from '../lib/supabase'
import { formatBr as formatPhone } from '../lib/phone'
import { boardKind, useLaunchActions, useLaunchState } from '../store/launchStore'
import { sendCustomMessage } from '../store/supabaseTransport'
import { useToast } from './toastContext'
import { useProfile } from './useActor'
import { MessageTemplatesPanel } from './MessageTemplatesPanel'

interface Stats {
  queued: number
  sent: number
  failed: number
  lastError: string | null
  configured: boolean | null
}

interface Recent {
  id: number
  kind: string
  person_name: string
  status: string
  created_at: string
}

const KIND_LABEL: Record<string, string> = {
  welcome: 'Boas-vindas',
  task_assigned: 'Tarefa atribuída',
  task_update: 'Tarefa atualizada',
  due_tomorrow: 'Prazo amanhã',
  due_today: 'Prazo hoje',
  overdue: 'Tarefa atrasada',
  task_done: 'Tarefa concluída',
  cost_new: 'Custo publicado',
  cost_decision: 'Custo decidido',
  meeting: 'Reunião',
  custom: 'Mensagem',
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'na fila',
  sent: 'enviada',
  failed: 'falhou',
}

/**
 * Resumo da fila de avisos no WhatsApp, clicável: abre as configurações (quais avisos automáticos
 * saem) e o envio de mensagem personalizada para pessoas do cadastro.
 */
export function NotificationStatus() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  const [open, setOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    let cancelled = false
    void (async () => {
      const { data } = await sb
        .from('comu_hub_notifications')
        .select('id,kind,person_name,status,error,created_at')
        .eq('launch_id', LAUNCH_ID)
        .order('id', { ascending: false })
        .limit(200)
      const { data: cfg } = await sb
        .from('comu_hub_settings')
        .select('value')
        .eq('key', 'whatsapp_configured')
        .maybeSingle()
      if (cancelled) return
      const rows = (data ?? []) as (Recent & { error: string | null })[]
      setStats({
        queued: rows.filter((r) => r.status === 'queued').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        failed: rows.filter((r) => r.status === 'failed').length,
        lastError: rows.find((r) => r.error)?.error ?? null,
        configured: cfg ? cfg.value === 'true' : false,
      })
      setRecent(rows.slice(0, 8))
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  if (!SYNC_ENABLED) return null
  const off = stats?.configured === false
  return (
    <div className={`card text-sm ${off ? 'border-lime/60 bg-lime/10' : ''}`}>
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left hover:bg-muted/40 sm:p-4"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MessageCircle className="size-4 shrink-0" aria-hidden />
        {stats === null ? (
          <span className="text-muted-foreground">Verificando avisos no WhatsApp…</span>
        ) : stats.configured ? (
          <>
            <span className="font-semibold">Avisos no WhatsApp ligados</span>
            <span className="text-muted-foreground">
              {stats.sent} enviados · {stats.queued} na fila · {stats.failed} com falha
            </span>
            {stats.lastError ? (
              <span className="text-xs text-danger">Último erro: {stats.lastError}</span>
            ) : null}
          </>
        ) : (
          <>
            <span className="font-semibold">Avisos no WhatsApp ainda não configurados.</span>
            <span className="text-muted-foreground">
              A fila já funciona ({stats.queued} aguardando); falta ligar a Evolution API no
              servidor.
            </span>
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {open ? 'Fechar' : 'Configurar avisos'}
          {open ? (
            <ChevronUp className="size-3.5" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden />
          )}
        </span>
      </button>

      {open ? (
        <div className="fade-in grid gap-5 border-t border-border p-4 sm:grid-cols-[1fr_1fr] sm:p-5">
          <NotificationPrefsPanel />
          <CustomMessagePanel onSent={() => setReloadKey((k) => k + 1)} />
          <MessageTemplatesPanel />
          {recent.length ? (
            <div className="sm:col-span-2">
              <p className="label-mono mb-2">Últimos avisos</p>
              <ul className="grid gap-1 text-xs">
                {recent.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-2 text-muted-foreground"
                  >
                    <span className="text-foreground">{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span>para {r.person_name || 'alguém'}</span>
                    <span
                      className={
                        r.status === 'failed'
                          ? 'text-danger'
                          : r.status === 'sent'
                            ? 'text-lime-foreground'
                            : ''
                      }
                    >
                      · {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="ml-auto">
                      {new Date(r.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type PrefKey = Exclude<keyof NotificationPrefs, 'overdueEveryDays' | 'overdueHour'>

const PREF_ROWS: { key: PrefKey; title: string; hint: string }[] = [
  {
    key: 'taskAssigned',
    title: 'Tarefa atribuída',
    hint: 'Quando alguém do cadastro vira responsável por uma tarefa.',
  },
  {
    key: 'dueTomorrow',
    title: 'Prazo: 1 dia antes',
    hint: 'Às 9h da manhã do dia anterior ao prazo, para o responsável da tarefa.',
  },
  {
    key: 'dueToday',
    title: 'Prazo: no mesmo dia',
    hint: 'Às 9h da manhã do dia do prazo, para o responsável da tarefa.',
  },
  {
    key: 'overdue',
    title: 'Tarefa atrasada',
    hint: 'Enquanto a tarefa estiver com o prazo vencido e sem ser marcada como feita.',
  },
  {
    key: 'taskDone',
    title: 'Tarefa concluída',
    hint: 'Quando alguém marca a tarefa como feita, os outros responsáveis recebem o aviso.',
  },
  {
    key: 'costNew',
    title: 'Custo publicado',
    hint: 'Na hora em que alguém publica um custo, para quem está no financeiro decidir.',
  },
  {
    key: 'costDecision',
    title: 'Custo aprovado ou reprovado',
    hint: 'A decisão do financeiro volta para quem publicou, com a justificativa.',
  },
]

/** Avisos do hub de conteúdo (o quadro de conteúdo não tem tarefa, custo nem reunião). */
const CONTENT_PREF_ROWS: { key: PrefKey; title: string; hint: string }[] = [
  {
    key: 'cardAssigned',
    title: 'Card atribuído',
    hint: 'Quando alguém do time vira responsável por um conteúdo.',
  },
  {
    key: 'cardDue',
    title: 'Prazo de produção',
    hint: 'Às 9h da véspera e do dia do prazo de produção, para os responsáveis.',
  },
  {
    key: 'contentReview',
    title: 'Conteúdo para aprovar',
    hint: 'Quando cards entram numa coluna em que o cliente aprova. Vários de uma vez viram uma mensagem só.',
  },
  {
    key: 'contentDecision',
    title: 'Decisão do cliente',
    hint: 'Quando o cliente aprova ou pede ajuste, os responsáveis recebem com o comentário.',
  },
  {
    key: 'contentComment',
    title: 'Comentário no card',
    hint: 'Os responsáveis recebem os comentários novos, menos o de quem escreveu.',
  },
  {
    key: 'contentPublishToday',
    title: 'Publica hoje',
    hint: 'Às 9h, lembra os responsáveis do que tem publicação no dia.',
  },
]

const EVERY_LABEL: Record<number, string> = {
  1: 'Todo dia',
  2: 'A cada 2 dias',
  3: 'A cada 3 dias',
  7: 'Uma vez por semana',
}

function NotificationPrefsPanel() {
  const s = useLaunchState()
  const { setNotificationPref, setOverdueEvery, setOverdueHour } = useLaunchActions()
  const toast = useToast()
  const financeNames = s.people.filter((p) => p.admin && p.finance).map((p) => p.name)
  const clientNames = s.people.filter((p) => p.client).map((p) => p.name)
  const rows = boardKind(s) === 'content' ? CONTENT_PREF_ROWS : PREF_ROWS
  return (
    <div>
      <p className="label-mono mb-2">Avisos automáticos</p>
      <ul className="grid gap-2">
        <li className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <BellRing className="mt-0.5 size-4 shrink-0 text-lime-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Boas-vindas ao cadastrar</p>
            <p className="text-xs text-muted-foreground">
              Link do painel para quem entra no time. Sempre automático, uma vez por pessoa.
            </p>
          </div>
          <span className="shrink-0 rounded bg-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-foreground">
            sempre
          </span>
        </li>
        {rows.map((row) => {
          const on = s.notifications[row.key]
          return (
            <li
              key={row.key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
            >
              <div className="flex items-start gap-3">
                <input
                  id={`pref-${row.key}`}
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={on}
                  onChange={(e) => {
                    setNotificationPref(row.key, e.target.checked)
                    toast(e.target.checked ? `${row.title}: ligado` : `${row.title}: desligado`)
                  }}
                />
                <label htmlFor={`pref-${row.key}`} className="min-w-0 flex-1 cursor-pointer">
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </label>
              </div>
              {row.key === 'costNew' ? (
                <p className="ml-7 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                  {financeNames.length ? (
                    <>
                      Vai para{' '}
                      <strong className="text-foreground">{financeNames.join(', ')}</strong>. Marque
                      quem recebe no chip "Financeiro" de cada pessoa, aqui em Usuários.
                    </>
                  ) : (
                    <>
                      Ninguém no financeiro ainda: marque alguém no chip "Financeiro" da lista de
                      usuários para os custos chegarem no WhatsApp.
                    </>
                  )}
                </p>
              ) : null}
              {row.key === 'contentReview' ? (
                <p className="ml-7 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                  {clientNames.length ? (
                    <>
                      Vai para <strong className="text-foreground">{clientNames.join(', ')}</strong>
                      . Quem é cliente se marca no chip "Cliente" de cada pessoa, aqui em Usuários.
                    </>
                  ) : (
                    <>
                      Ninguém marcado como cliente ainda: use o chip "Cliente" na lista de usuários
                      para quem aprova os conteúdos.
                    </>
                  )}
                </p>
              ) : null}
              {row.key === 'overdue' ? (
                <div className="ml-7 flex flex-wrap items-center gap-2 border-l-2 border-border pl-3">
                  <label
                    htmlFor="pref-overdueEveryDays"
                    className={`text-xs ${!on ? 'opacity-50' : ''}`}
                  >
                    Repetir a cobrança
                  </label>
                  <select
                    id="pref-overdueEveryDays"
                    className="field h-8 w-auto py-0 text-sm"
                    disabled={!on}
                    value={s.notifications.overdueEveryDays}
                    onChange={(e) => {
                      const days = Number(e.target.value)
                      setOverdueEvery(days)
                      toast(`Tarefa atrasada: ${EVERY_LABEL[days].toLowerCase()}`)
                    }}
                  >
                    {OVERDUE_EVERY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {EVERY_LABEL[d]}
                      </option>
                    ))}
                  </select>
                  <label
                    htmlFor="pref-overdueHour"
                    className={`text-xs ${!on ? 'opacity-50' : ''}`}
                  >
                    às
                  </label>
                  <select
                    id="pref-overdueHour"
                    className="field h-8 w-auto py-0 text-sm"
                    disabled={!on}
                    value={s.notifications.overdueHour}
                    onChange={(e) => {
                      const hour = Number(e.target.value)
                      setOverdueHour(hour)
                      toast(`Tarefa atrasada: às ${String(hour).padStart(2, '0')}:00`)
                    }}
                  >
                    {OVERDUE_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {`${String(h).padStart(2, '0')}:00`}
                      </option>
                    ))}
                  </select>
                  <span className={`text-xs text-muted-foreground ${!on ? 'opacity-50' : ''}`}>
                    Horário de Brasília. A frequência conta a partir do último aviso daquela tarefa.
                  </span>
                </div>
              ) : null}
              {row.key === 'taskAssigned' ? (
                <div className="ml-7 flex items-start gap-3 border-l-2 border-border pl-3">
                  <input
                    id="pref-taskAssignedRequireDue"
                    type="checkbox"
                    className="checkbox mt-0.5"
                    checked={s.notifications.taskAssignedRequireDue}
                    disabled={!on}
                    onChange={(e) => {
                      setNotificationPref('taskAssignedRequireDue', e.target.checked)
                      toast(
                        e.target.checked
                          ? 'Só avisa se a tarefa tiver prazo'
                          : 'Avisa com ou sem prazo',
                      )
                    }}
                  />
                  <label
                    htmlFor="pref-taskAssignedRequireDue"
                    className={`min-w-0 flex-1 cursor-pointer ${!on ? 'opacity-50' : ''}`}
                  >
                    <p className="text-sm font-semibold">Só quando a tarefa já tiver prazo</p>
                    <p className="text-xs text-muted-foreground">
                      Desligado, avisa mesmo em tarefas sem data.
                    </p>
                  </label>
                </div>
              ) : null}
            </li>
          )
        })}
        <li className="flex items-start gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-muted-foreground">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Reunião marcada</p>
            <p className="text-xs">
              Escolhido reunião a reunião, nos chips "Avisar no WhatsApp" ao marcar.
            </p>
          </div>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Vale para todo o time. Quem não quer receber nada desliga os avisos no próprio cadastro.
      </p>
    </div>
  )
}

function CustomMessagePanel({ onSent }: { onSent: () => void }) {
  const s = useLaunchState()
  const profile = useProfile()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const eligible = [...s.people]
    .filter((p) => p.phone && p.notify)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const allSelected = eligible.length > 0 && eligible.every((p) => selected.has(p.id))

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!message.trim() || selected.size === 0 || sending) return
        setSending(true)
        try {
          const r = await sendCustomMessage([...selected], message.trim(), profile)
          toast(
            r.sent === 1
              ? `Mensagem na fila para ${r.names[0]}`
              : `Mensagem na fila para ${r.sent} pessoas`,
          )
          setMessage('')
          setSelected(new Set())
          onSent()
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Não foi possível enviar')
        } finally {
          setSending(false)
        }
      }}
    >
      <p className="label-mono mb-2">Mensagem personalizada</p>
      {eligible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Ninguém com WhatsApp e avisos ligados no cadastro ainda.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={`chip ${allSelected ? 'chip-active' : ''}`}
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(eligible.map((p) => p.id)))
              }
            >
              Todos ({eligible.length})
            </button>
            {eligible.map((p) => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${on ? 'chip-active' : ''}`}
                  aria-pressed={on}
                  title={formatPhone(p.phone)}
                  onClick={() =>
                    setSelected((cur) => {
                      const n = new Set(cur)
                      if (n.has(p.id)) n.delete(p.id)
                      else n.add(p.id)
                      return n
                    })
                  }
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          <textarea
            className="field min-h-24 resize-y"
            placeholder="Escreva a mensagem. Sai com o seu nome no rodapé."
            aria-label="Mensagem personalizada"
            maxLength={1500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {selected.size === 0
                ? 'Escolha quem recebe'
                : `${selected.size} ${selected.size === 1 ? 'pessoa' : 'pessoas'} · ${message.length}/1500`}
            </span>
            <button
              type="submit"
              className="btn-primary"
              disabled={!message.trim() || selected.size === 0 || sending}
            >
              <Send className="size-4" aria-hidden />
              {sending ? 'Enviando…' : 'Enviar no WhatsApp'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
