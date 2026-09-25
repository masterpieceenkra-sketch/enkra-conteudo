import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  PenLine,
  Send,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AutoTextarea } from '../../components/AutoTextarea'
import { useToast } from '../../components/toastContext'
import { formatBr, todayIso } from '../../lib/dates'
import { SYNC_ENABLED } from '../../lib/supabase'
import { useLaunchState } from '../../store/launchStore'
import { isImage, isVideo, useSignedUrl } from '../attachments'
import { CardDrawer } from '../CardDrawer'
import {
  FORMAT_LABEL,
  NETWORK_LABEL,
  columnOf,
  pendingReview,
  type Attachment,
  type ContentCard,
  type ContentState,
} from '../model'
import { notifyPendingReview, reviewCard, type ReviewDecision } from '../review'
import { useIsClient } from '../roles'
import { ApprovalBadge } from '../ui'
import { useCardParam } from '../useCardParam'
import { contentOf } from '../useContent'
import { FORMAT_ICON, SOLID } from '../visual'

export function ApprovalsPage() {
  const s = useLaunchState()
  const content = contentOf(s)
  const client = useIsClient()
  const toast = useToast()
  const [openId, open, close] = useCardParam()
  const [notifying, setNotifying] = useState(false)
  const pending = pendingReview(content)
  const adjusting = content.cards.filter((k) => k.approval?.state === 'ajuste')
  const approved = content.cards
    .filter((k) => k.approval?.state === 'aprovado')
    .sort((a, b) => (b.approval?.at ?? '').localeCompare(a.approval?.at ?? ''))
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono flex items-center gap-2">
            <span className="brand-squares" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {client ? 'Sua vez' : 'Aprovação do cliente'}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl">Para aprovar</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {client
              ? pending.length
                ? `${pending.length} ${pending.length === 1 ? 'conteúdo espera' : 'conteúdos esperam'} a sua aprovação. Aprovando, o time segue para a próxima etapa; pedindo ajuste, ele recebe o seu comentário no WhatsApp.`
                : 'Tudo aprovado por aqui. Quando o time mandar algo novo, você recebe no WhatsApp.'
              : 'O que está com o cliente agora. Cards entram aqui quando vão para uma coluna em que o cliente aprova.'}
          </p>
        </div>
        {!client && SYNC_ENABLED && pending.length ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={notifying}
            onClick={async () => {
              setNotifying(true)
              try {
                const n = await notifyPendingReview()
                toast(
                  n
                    ? `Aviso enviado para ${n} ${n === 1 ? 'pessoa' : 'pessoas'} do cliente`
                    : 'Ninguém marcado como cliente (ou com avisos desligados)',
                  n ? 'ok' : 'error',
                )
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Não consegui avisar', 'error')
              } finally {
                setNotifying(false)
              }
            }}
          >
            {notifying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Avisar o cliente agora ({pending.length})
          </button>
        ) : null}
      </div>

      {pending.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-lime text-lime-foreground">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="font-display text-xl font-bold">Nada esperando aprovação</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {client
              ? 'Quando houver conteúdo novo para você ver, ele aparece aqui.'
              : 'Mova um card para uma coluna com o selo de aprovação (Ideias, Em revisão) e ele entra aqui.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-5">
          {pending.map((k) => (
            <ReviewItem
              key={k.id}
              card={k}
              content={content}
              canDecide={client}
              onOpen={() => open(k.id)}
            />
          ))}
        </ul>
      )}

      {adjusting.length ? (
        <Section title="Ajustes pedidos" hint="O time está trabalhando nisso.">
          {adjusting.map((k) => (
            <MiniRow key={k.id} card={k} onOpen={() => open(k.id)} />
          ))}
        </Section>
      ) : null}
      {approved.length ? (
        <Section title="Aprovados recentemente">
          {approved.map((k) => (
            <MiniRow key={k.id} card={k} onOpen={() => open(k.id)} />
          ))}
        </Section>
      ) : null}

      <CardDrawer cardId={openId} onClose={close} readOnly={client} />
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold uppercase tracking-[-0.01em]">{title}</h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">{children}</ul>
    </section>
  )
}

function MiniRow({ card, onOpen }: { card: ContentCard; onOpen: () => void }) {
  const Icon = FORMAT_ICON[card.format]
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="card flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:border-muted-foreground/40"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{card.title || 'Sem título'}</span>
          {card.approval?.note ? (
            <span className="block truncate text-xs text-muted-foreground">
              “{card.approval.note}”
            </span>
          ) : null}
        </span>
        {card.approval ? <ApprovalBadge state={card.approval.state} /> : null}
      </button>
    </li>
  )
}

function ReviewItem({
  card,
  content,
  canDecide,
  onOpen,
}: {
  card: ContentCard
  content: ContentState
  canDecide: boolean
  onOpen: () => void
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'idle' | 'ajuste' | 'comentario'>('idle')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<ReviewDecision | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)
  const Icon = FORMAT_ICON[card.format]
  const column = columnOf(content, card)
  const campaign = content.campaigns.find((c) => c.id === card.campaignId)
  const visuals = card.attachments.filter((a) => isImage(a) || isVideo(a))
  const files = card.attachments.filter((a) => !isImage(a) && !isVideo(a))
  const [shown, setShown] = useState(card.coverId || visuals[0]?.id || '')
  const main = visuals.find((a) => a.id === shown) ?? visuals[0]
  const late = card.publishAt && card.publishAt < todayIso()

  async function decide(decision: ReviewDecision) {
    if (decision !== 'aprovado' && !text.trim()) return
    setBusy(decision)
    try {
      await reviewCard(card.id, decision, text)
      toast(
        decision === 'aprovado'
          ? 'Aprovado. O time já foi avisado.'
          : decision === 'ajuste'
            ? 'Pedido de ajuste enviado para o time.'
            : 'Comentário enviado.',
      )
      setText('')
      setMode('idle')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui enviar', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="card overflow-hidden">
      {/* sem mídia, o bloco de prévia some e o texto ocupa a largura toda */}
      <div className={`grid ${main ? 'md:grid-cols-[minmax(0,22rem)_1fr]' : ''}`}>
        {main ? (
          <div className="border-b border-border bg-surface-2 md:border-r md:border-b-0">
            <Media att={main} />
            {visuals.length > 1 ? (
              <div className="flex gap-1.5 overflow-x-auto p-2">
                {visuals.map((a) => (
                  <Thumb
                    key={a.id}
                    att={a}
                    active={a.id === main?.id}
                    onClick={() => setShown(a.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Icon className="size-3.5" aria-hidden /> {FORMAT_LABEL[card.format]}
              </span>
              {card.networks.length ? (
                <span>· {card.networks.map((n) => NETWORK_LABEL[n]).join(', ')}</span>
              ) : null}
              {column ? <span>· {column.name}</span> : null}
              {campaign ? (
                <span className="inline-flex items-center gap-1">
                  · <span className={`size-2 rounded-full ${SOLID[campaign.color]}`} aria-hidden />{' '}
                  {campaign.name}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-[-0.03em]">
              {card.title || 'Sem título'}
            </h2>
            {card.publishAt ? (
              <p className={`mt-1 text-sm font-semibold ${late ? 'text-danger' : ''}`}>
                Publicação: {formatBr(card.publishAt)}
                {card.publishTime ? ` às ${card.publishTime}` : ''}
              </p>
            ) : null}
          </div>

          {card.caption ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="label-mono">Legenda</p>
                <button
                  type="button"
                  className="btn-ghost h-7 px-2 py-0 text-xs"
                  onClick={() =>
                    void navigator.clipboard.writeText(card.caption).then(
                      () => toast('Legenda copiada'),
                      () => toast('Não consegui copiar', 'error'),
                    )
                  }
                >
                  <Copy className="size-3.5" aria-hidden /> Copiar
                </button>
              </div>
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
                {card.caption}
              </p>
            </div>
          ) : null}

          {card.briefing ? (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                aria-expanded={briefOpen}
                onClick={() => setBriefOpen((o) => !o)}
              >
                <ChevronDown
                  className={`size-3.5 transition-transform ${briefOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                Roteiro e briefing
              </button>
              {briefOpen ? (
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm [overflow-wrap:anywhere]">
                  {card.briefing}
                </p>
              ) : null}
            </div>
          ) : null}

          {files.length || card.links.length ? (
            <ul className="flex flex-wrap gap-2">
              {files.map((f) => (
                <FileChip key={f.id} att={f} />
              ))}
              {card.links.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="chip">
                    <ExternalLink className="size-3.5" aria-hidden /> {l.label || 'Link'}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {card.comments.length ? (
            <div className="rounded-xl border border-border p-3">
              <p className="label-mono mb-2 flex items-center gap-1.5">
                <MessageSquare className="size-3.5" aria-hidden /> Últimos comentários
              </p>
              <ul className="flex flex-col gap-2">
                {card.comments.slice(-3).map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-bold">{c.authorName || 'Alguém'}:</span>{' '}
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
            {canDecide ? (
              mode === 'idle' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary h-11 px-5 text-base"
                    disabled={busy !== null}
                    onClick={() => void decide('aprovado')}
                  >
                    {busy === 'aprovado' ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-4" aria-hidden />
                    )}
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-11 px-4"
                    onClick={() => setMode('ajuste')}
                  >
                    <PenLine className="size-4" aria-hidden /> Pedir ajuste
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-11 px-4"
                    onClick={() => setMode('comentario')}
                  >
                    <MessageSquare className="size-4" aria-hidden /> Comentar
                  </button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void decide(mode)
                  }}
                >
                  <label className="label-mono" htmlFor={`txt-${card.id}`}>
                    {mode === 'ajuste' ? 'O que precisa mudar?' : 'Seu comentário'}
                  </label>
                  <AutoTextarea
                    id={`txt-${card.id}`}
                    value={text}
                    onChange={setText}
                    minRows={3}
                    placeholder={
                      mode === 'ajuste'
                        ? 'Ex.: trocar a trilha, deixar a legenda mais curta, outra foto na capa'
                        : 'Escreva para o time'
                    }
                    className="field"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={!text.trim() || busy !== null}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="size-4" aria-hidden />
                      )}
                      {mode === 'ajuste' ? 'Enviar pedido de ajuste' : 'Enviar comentário'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setMode('idle')
                        setText('')
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Com o cliente · coluna {column?.name ?? 'de aprovação'}.
              </p>
            )}
            <button
              type="button"
              className="self-start text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={onOpen}
            >
              Abrir o card completo
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function Media({ att }: { att: Attachment }) {
  const url = useSignedUrl(att.path)
  if (!url) return <div className="aspect-[4/5] w-full animate-pulse bg-muted" aria-hidden />
  if (isVideo(att))
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="aspect-[4/5] w-full bg-black object-contain"
      />
    )
  return <img src={url} alt={att.name} className="aspect-[4/5] w-full bg-black object-contain" />
}

function Thumb({
  att,
  active,
  onClick,
}: {
  att: Attachment
  active: boolean
  onClick: () => void
}) {
  const url = useSignedUrl(att.path)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver ${att.name}`}
      aria-pressed={active}
      className={`size-14 shrink-0 overflow-hidden rounded-lg bg-muted ${active ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'}`}
    >
      {url && isImage(att) ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : url ? (
        <video src={`${url}#t=0.5`} muted preload="metadata" className="size-full object-cover" />
      ) : null}
    </button>
  )
}

function FileChip({ att }: { att: Attachment }) {
  const url = useSignedUrl(att.path)
  return (
    <li>
      <a href={url || undefined} target="_blank" rel="noreferrer" className="chip">
        <FileText className="size-3.5" aria-hidden /> {att.name}
      </a>
    </li>
  )
}
