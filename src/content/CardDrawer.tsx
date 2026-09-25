import {
  AlignLeft,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  SquareCheck,
  Star,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AutoTextarea } from '../components/AutoTextarea'
import { LabelChip } from '../components/LabelChip'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'
import { useMe } from '../components/useActor'
import { isHttpUrl } from '../data/labels'
import type { Label, LabelColor, Person } from '../data/types'
import { formatBr, todayIso } from '../lib/dates'
import { boardUrl } from '../lib/board'
import { SYNC_ENABLED } from '../lib/supabase'
import { useLaunchActions, useLaunchState } from '../store/launchStore'
import {
  deleteAttachmentFile,
  isImage,
  isVideo,
  uploadAttachment,
  useSignedUrl,
} from './attachments'
import {
  FORMATS,
  FORMAT_LABEL,
  LIMITS,
  NETWORKS,
  NETWORK_LABEL,
  checklistDone,
  formatBytes,
  type Attachment,
  type ContentCard,
  type ContentState,
} from './model'
import { reviewCard } from './review'
import { ApprovalBadge, Avatar } from './ui'
import { SOLID } from './visual'
import { contentOf, useContentActions } from './useContent'

interface Props {
  cardId: string | null
  onClose: () => void
  /** cliente vê tudo, mas só comenta (e aprova, na fila de aprovação) */
  readOnly?: boolean
}

/** Card aberto: painel lateral com tudo que a peça precisa, do roteiro ao link publicado. */
export function CardDrawer({ cardId, onClose, readOnly = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const s = useLaunchState()
  const content = contentOf(s)
  const card = cardId ? content.cards.find((k) => k.id === cardId) : undefined

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (card && !d.open) d.showModal()
    if (!card && d.open) d.close()
  }, [card])

  return (
    <dialog
      ref={ref}
      aria-label={card ? card.title || 'Card' : 'Card'}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="drawer m-0 ml-auto h-dvh max-h-dvh w-full max-w-2xl overflow-hidden border-l border-border bg-surface p-0 text-foreground shadow-2xl"
    >
      {card ? (
        <Body
          key={card.id}
          card={card}
          content={content}
          labels={s.labels}
          people={s.people}
          onClose={onClose}
          readOnly={readOnly}
        />
      ) : null}
    </dialog>
  )
}

function Section({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-border px-5 py-5 sm:px-7">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
        <h3 className="text-sm font-bold uppercase tracking-[0.08em]">{title}</h3>
        {aside ? <div className="ml-auto">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  )
}

function Body({
  card,
  content,
  labels,
  people,
  onClose,
  readOnly,
}: {
  card: ContentCard
  content: ContentState
  labels: Label[]
  people: Person[]
  onClose: () => void
  readOnly: boolean
}) {
  const a = useContentActions()
  const { addLabel } = useLaunchActions()
  const confirm = useConfirm()
  const toast = useToast()
  const me = useMe()
  const [menu, setMenu] = useState(false)
  const column = content.columns.find((c) => c.id === card.columnId)
  const pillars = content.strategy.pillars.filter((p) => p.name.trim())
  const series = content.strategy.series.filter((p) => p.name.trim())
  const today = todayIso()
  const late = card.publishAt !== '' && card.publishAt < today && column?.stage !== 'published'
  const dis = readOnly

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(boardUrl(`/quadro?card=${card.id}`))
      toast('Link do card copiado')
    } catch {
      toast('Não consegui copiar', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <span className={`size-2.5 shrink-0 rounded-full ${SOLID[column?.color ?? 'gray']}`} />
        <select
          className="field h-8 w-auto py-0 pr-7 text-xs font-bold uppercase tracking-wider"
          aria-label="Status"
          value={card.columnId}
          disabled={dis}
          onChange={(e) => a.move(card.id, e.target.value, Number.MAX_SAFE_INTEGER)}
        >
          {content.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {card.approval ? <ApprovalBadge state={card.approval.state} /> : null}
        <div className="relative ml-auto flex items-center gap-1">
          {!dis ? (
            <button
              type="button"
              className="icon-btn"
              aria-label="Mais ações"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          ) : null}
          {menu ? (
            <div
              role="menu"
              className="fade-in absolute right-9 top-full z-10 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg"
            >
              <MenuButton
                icon={<Copy className="size-4" />}
                onClick={() => {
                  setMenu(false)
                  a.duplicate(card.id)
                  toast('Card duplicado logo abaixo do original')
                }}
              >
                Duplicar
              </MenuButton>
              <MenuButton
                icon={<Link2 className="size-4" />}
                onClick={() => {
                  setMenu(false)
                  void copyLink()
                }}
              >
                Copiar link do card
              </MenuButton>
              <MenuButton
                danger
                icon={<Trash2 className="size-4" />}
                onClick={() => {
                  setMenu(false)
                  confirm({
                    title: 'Excluir este card?',
                    description:
                      'Some do quadro, do calendário e do cronograma. Os anexos também são apagados.',
                    confirmLabel: 'Excluir',
                    danger: true,
                    onConfirm: () => {
                      for (const att of card.attachments) void deleteAttachmentFile(att.path)
                      a.remove(card.id)
                      onClose()
                    },
                  })
                }}
              >
                Excluir card
              </MenuButton>
            </div>
          ) : null}
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-5 pb-4 sm:px-7">
          <AutoTextarea
            value={card.title}
            onChange={(v) =>
              a.updateCard(card.id, { title: v.replace(/\n/g, ' ').slice(0, LIMITS.title) })
            }
            minRows={1}
            placeholder="Título do conteúdo"
            aria-label="Título"
            className={`w-full resize-none border-0 bg-transparent p-0 font-display text-2xl font-bold leading-tight tracking-[-0.03em] outline-none placeholder:text-muted-foreground/60 ${dis ? 'pointer-events-none' : ''}`}
          />
          {late ? (
            <p className="mt-2 text-xs font-semibold text-danger">
              A data de publicação ({formatBr(card.publishAt)}) já passou e o card não está em
              Publicado.
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Publicação">
              <input
                type="date"
                className="field py-1.5"
                value={card.publishAt}
                disabled={dis}
                onChange={(e) => a.updateCard(card.id, { publishAt: e.target.value })}
              />
            </Field>
            <Field label="Horário">
              <input
                type="time"
                className="field py-1.5"
                value={card.publishTime}
                disabled={dis}
                onChange={(e) => a.updateCard(card.id, { publishTime: e.target.value })}
              />
            </Field>
            <Field label="Prazo de produção">
              <input
                type="date"
                className="field py-1.5"
                value={card.due}
                disabled={dis}
                onChange={(e) => a.updateCard(card.id, { due: e.target.value })}
              />
            </Field>
            <Field label="Formato">
              <select
                className="field py-1.5"
                value={card.format}
                disabled={dis}
                onChange={(e) =>
                  a.updateCard(card.id, { format: e.target.value as ContentCard['format'] })
                }
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Campanha">
              <select
                className="field py-1.5"
                value={card.campaignId}
                disabled={dis}
                onChange={(e) => a.updateCard(card.id, { campaignId: e.target.value })}
              >
                <option value="">Sem campanha</option>
                {content.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {pillars.length ? (
              <Field label="Pilar">
                <select
                  className="field py-1.5"
                  value={card.pillarId}
                  disabled={dis}
                  onChange={(e) => a.updateCard(card.id, { pillarId: e.target.value })}
                >
                  <option value="">Sem pilar</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {series.length ? (
              <Field label="Série">
                <select
                  className="field py-1.5"
                  value={card.seriesId}
                  disabled={dis}
                  onChange={(e) => a.updateCard(card.id, { seriesId: e.target.value })}
                >
                  <option value="">Sem série</option>
                  {series.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <span className="label-mono">Redes</span>
            <div className="flex flex-wrap gap-1.5">
              {NETWORKS.map((n) => {
                const on = card.networks.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={dis}
                    aria-pressed={on}
                    className={`chip ${on ? 'chip-active' : ''}`}
                    onClick={() =>
                      a.updateCard(card.id, {
                        networks: on ? card.networks.filter((x) => x !== n) : [...card.networks, n],
                      })
                    }
                  >
                    {NETWORK_LABEL[n]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <span className="label-mono">Responsáveis</span>
            {people.length ? (
              <div className="flex flex-wrap gap-1.5">
                {people.map((p, i) => {
                  const on = card.ownerIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={dis}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-3 pl-0.5 text-xs font-semibold transition-colors ${
                        on
                          ? 'border-secondary bg-secondary text-secondary-foreground'
                          : 'border-border hover:bg-muted'
                      }`}
                      onClick={() =>
                        a.setOwners(
                          card.id,
                          on ? card.ownerIds.filter((x) => x !== p.id) : [...card.ownerIds, p.id],
                        )
                      }
                    >
                      <Avatar person={p} index={i} />
                      {p.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cadastre o time em Usuários para escolher responsáveis.
              </p>
            )}
          </div>

          <LabelsField card={card} labels={labels} disabled={dis} onAdd={addLabel} />
        </div>

        {readOnly && card.approval?.state === 'pendente' && column?.clientApproves ? (
          <ClientDecision cardId={card.id} />
        ) : null}

        {card.approval?.state === 'ajuste' && card.approval.note ? (
          <div className="mx-5 mb-4 rounded-xl border border-primary/40 bg-pink-soft/60 p-3 text-sm sm:mx-7">
            <p className="label-mono text-foreground">
              Ajuste pedido{card.approval.byName ? ` por ${card.approval.byName}` : ''}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{card.approval.note}</p>
          </div>
        ) : null}

        <Section icon={<AlignLeft className="size-4" />} title="Briefing e roteiro">
          <AutoTextarea
            value={card.briefing}
            onChange={(v) => a.updateCard(card.id, { briefing: v.slice(0, LIMITS.briefing) })}
            minRows={4}
            placeholder="Ideia, referência, gancho, roteiro cena a cena…"
            aria-label="Briefing e roteiro"
            className={`field ${dis ? 'pointer-events-none' : ''}`}
          />
        </Section>

        <Section
          icon={<Type className="size-4" />}
          title="Legenda"
          aside={
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold tabular-nums ${card.caption.length > 2200 ? 'text-danger' : 'text-muted-foreground'}`}
                title="O Instagram aceita até 2.200 caracteres"
              >
                {card.caption.length}/2.200
              </span>
              {card.caption ? (
                <button
                  type="button"
                  className="btn-ghost h-7 px-2 py-0 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(card.caption).then(
                      () => toast('Legenda copiada'),
                      () => toast('Não consegui copiar', 'error'),
                    )
                  }}
                >
                  <Copy className="size-3.5" aria-hidden /> Copiar
                </button>
              ) : null}
            </div>
          }
        >
          <AutoTextarea
            value={card.caption}
            onChange={(v) => a.updateCard(card.id, { caption: v.slice(0, LIMITS.caption) })}
            minRows={4}
            placeholder="Texto do post, CTA e hashtags"
            aria-label="Legenda"
            className={`field ${dis ? 'pointer-events-none' : ''}`}
          />
        </Section>

        <Attachments card={card} disabled={dis} />

        <LinksSection card={card} disabled={dis} />

        <ChecklistSection card={card} disabled={dis} />

        {column?.stage === 'published' || column?.stage === 'scheduled' || card.publishedUrl ? (
          <Section icon={<ExternalLink className="size-4" />} title="Post publicado">
            <PublishedUrl card={card} disabled={dis} />
          </Section>
        ) : null}

        <Comments card={card} people={people} meId={me?.id ?? ''} viaServer={readOnly} />

        <p className="px-5 pb-8 pt-2 text-[11px] text-muted-foreground sm:px-7">
          Criado{card.createdBy ? ` por ${card.createdBy}` : ''}
          {card.createdAt ? ` em ${new Date(card.createdAt).toLocaleDateString('pt-BR')}` : ''}
        </p>
      </div>
    </div>
  )
}

/** Aprovar ou pedir ajuste de dentro do card (cliente). */
function ClientDecision({ cardId }: { cardId: string }) {
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  async function send(decision: 'aprovado' | 'ajuste') {
    setBusy(true)
    try {
      await reviewCard(cardId, decision, text)
      toast(
        decision === 'aprovado' ? 'Aprovado. O time já foi avisado.' : 'Pedido de ajuste enviado.',
      )
      setAsking(false)
      setText('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não consegui enviar', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mx-5 mb-4 rounded-xl border border-blue/40 bg-blue-soft/50 p-3 sm:mx-7">
      <p className="text-sm font-semibold">Este conteúdo espera a sua aprovação.</p>
      {asking ? (
        <div className="mt-2 flex flex-col gap-2">
          <AutoTextarea
            value={text}
            onChange={setText}
            minRows={2}
            placeholder="O que precisa mudar?"
            aria-label="O que precisa mudar"
            className="field"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!text.trim() || busy}
              onClick={() => void send('ajuste')}
            >
              Enviar pedido de ajuste
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAsking(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void send('aprovado')}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Aprovar
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAsking(true)}>
            Pedir ajuste
          </button>
        </div>
      )}
    </div>
  )
}

function MenuButton({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${danger ? 'text-danger' : ''}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  )
}

const NEW_LABEL_COLORS: LabelColor[] = ['pink', 'blue', 'aqua', 'lime', 'black', 'gray']

function LabelsField({
  card,
  labels,
  disabled,
  onAdd,
}: {
  card: ContentCard
  labels: Label[]
  disabled: boolean
  onAdd: (name: string, color: LabelColor) => string
}) {
  const a = useContentActions()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<LabelColor>('pink')
  const visible = disabled ? labels.filter((l) => card.labelIds.includes(l.id)) : labels
  if (disabled && visible.length === 0) return null
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <span className="label-mono">Etiquetas</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((l) => (
          <LabelChip
            key={l.id}
            label={l}
            size="md"
            active={card.labelIds.includes(l.id)}
            onClick={disabled ? undefined : () => a.toggleLabel(card.id, l.id)}
          />
        ))}
        {!disabled && !adding ? (
          <button
            type="button"
            className="btn-ghost h-7 px-2 py-0 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden /> Nova
          </button>
        ) : null}
      </div>
      {adding ? (
        <form
          className="mt-1 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const id = onAdd(name, color)
            if (id) a.toggleLabel(card.id, id)
            setName('')
            setAdding(false)
          }}
        >
          <input
            className="field h-8 w-44 py-0 text-sm"
            placeholder="Nome da etiqueta"
            value={name}
            maxLength={40}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-1" role="radiogroup" aria-label="Cor">
            {NEW_LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`size-6 rounded-md ${SOLID[c]} ${color === c ? 'ring-2 ring-ring ring-offset-2 ring-offset-surface' : ''}`}
              />
            ))}
          </div>
          <button
            type="submit"
            className="btn-secondary h-8 px-3 py-0 text-xs"
            disabled={!name.trim()}
          >
            Criar
          </button>
          <button
            type="button"
            className="btn-ghost h-8 px-3 py-0 text-xs"
            onClick={() => setAdding(false)}
          >
            Cancelar
          </button>
        </form>
      ) : null}
    </div>
  )
}

function Attachments({ card, disabled }: { card: ContentCard; disabled: boolean }) {
  const a = useContentActions()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string[]>([])
  const [over, setOver] = useState(false)

  async function send(files: FileList | File[]) {
    const list = [...files].slice(0, LIMITS.attachments - card.attachments.length)
    for (const f of list) {
      setUploading((u) => [...u, f.name])
      try {
        const att = await uploadAttachment(card.id, f)
        a.addAttachment(card.id, att)
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Falha ao enviar o arquivo', 'error')
      } finally {
        setUploading((u) => {
          const i = u.indexOf(f.name)
          return i === -1 ? u : [...u.slice(0, i), ...u.slice(i + 1)]
        })
      }
    }
  }

  return (
    <Section
      icon={<Paperclip className="size-4" />}
      title="Anexos"
      aside={
        !disabled && SYNC_ENABLED ? (
          <button
            type="button"
            className="btn-ghost h-7 px-2 py-0 text-xs"
            onClick={() => input.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden /> Enviar
          </button>
        ) : null
      }
    >
      {!disabled && SYNC_ENABLED ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            if (e.dataTransfer.files.length) void send(e.dataTransfer.files)
          }}
          onClick={() => input.current?.click()}
          className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${
            over
              ? 'border-primary bg-pink-soft/40'
              : 'border-border hover:border-muted-foreground/50'
          }`}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <span className="font-semibold">Arraste arquivos aqui ou clique para escolher</span>
          <span className="text-xs text-muted-foreground">
            Imagem, vídeo, PDF · até 50 MB por arquivo. Vídeo maior: use um link do Drive.
          </span>
        </div>
      ) : null}
      {!SYNC_ENABLED && !disabled ? (
        <p className="mb-3 text-xs text-muted-foreground">
          No modo local os arquivos não são guardados. Use links por enquanto.
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void send(e.target.files)
          e.target.value = ''
        }}
      />
      {card.attachments.length || uploading.length ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {card.attachments.map((att) => (
            <AttachmentTile
              key={att.id}
              att={att}
              cover={card.coverId === att.id}
              disabled={disabled}
              onCover={() =>
                a.updateCard(card.id, { coverId: card.coverId === att.id ? '' : att.id })
              }
              onRemove={() =>
                confirm({
                  title: `Apagar ${att.name}?`,
                  description: 'O arquivo sai do card e do armazenamento.',
                  confirmLabel: 'Apagar',
                  danger: true,
                  onConfirm: () => {
                    a.removeAttachment(card.id, att.id)
                    void deleteAttachmentFile(att.path)
                  },
                })
              }
            />
          ))}
          {uploading.map((name, i) => (
            <li
              key={`${name}-${i}`}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted p-2 text-center text-xs text-muted-foreground"
            >
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{name}</span>
            </li>
          ))}
        </ul>
      ) : disabled || !SYNC_ENABLED ? (
        <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
      ) : null}
    </Section>
  )
}

function AttachmentTile({
  att,
  cover,
  disabled,
  onCover,
  onRemove,
}: {
  att: Attachment
  cover: boolean
  disabled: boolean
  onCover: () => void
  onRemove: () => void
}) {
  const url = useSignedUrl(att.path)
  const visual = isImage(att) || isVideo(att)
  return (
    <li className="group relative overflow-hidden rounded-xl border border-border bg-muted">
      <a
        href={url || undefined}
        target="_blank"
        rel="noreferrer"
        className="block aspect-square"
        aria-label={`Abrir ${att.name}`}
      >
        {url && isImage(att) ? (
          <img src={url} alt="" loading="lazy" className="size-full object-cover" />
        ) : url && isVideo(att) ? (
          <video
            src={`${url}#t=0.5`}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center">
            <FileText className="size-6 text-muted-foreground" aria-hidden />
            <span className="line-clamp-2 text-xs font-semibold [overflow-wrap:anywhere]">
              {att.name}
            </span>
          </span>
        )}
      </a>
      <div className="flex items-center gap-1 border-t border-border bg-surface px-2 py-1.5">
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground"
          title={att.name}
        >
          {formatBytes(att.size)}
        </span>
        {!disabled && visual ? (
          <button
            type="button"
            className={`icon-btn size-6 ${cover ? 'text-primary' : ''}`}
            aria-label={cover ? 'Tirar da capa' : 'Usar como capa'}
            aria-pressed={cover}
            title={cover ? 'Capa do card' : 'Usar como capa'}
            onClick={onCover}
          >
            <Star className="size-3.5" fill={cover ? 'currentColor' : 'none'} aria-hidden />
          </button>
        ) : null}
        {!disabled ? (
          <button
            type="button"
            className="icon-btn size-6 hover:text-danger"
            aria-label={`Apagar ${att.name}`}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  )
}

function LinksSection({ card, disabled }: { card: ContentCard; disabled: boolean }) {
  const a = useContentActions()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const ok = isHttpUrl(url.trim())
  if (disabled && card.links.length === 0) return null
  return (
    <Section icon={<Link2 className="size-4" />} title="Links">
      {card.links.length ? (
        <ul className="mb-3 flex flex-col gap-1.5">
          {card.links.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline"
              >
                {l.label || l.url}
              </a>
              {!disabled ? (
                <button
                  type="button"
                  className="icon-btn size-6 hover:text-danger"
                  aria-label="Remover link"
                  onClick={() => a.removeLink(card.id, l.id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!disabled ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ok) return
            a.addLink(card.id, url, label)
            setUrl('')
            setLabel('')
          }}
        >
          <input
            className="field h-9 py-0 text-sm sm:flex-[2]"
            placeholder="https://drive.google.com/…"
            value={url}
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            aria-label="Endereço do link"
          />
          <input
            className="field h-9 py-0 text-sm sm:flex-1"
            placeholder="Nome (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Nome do link"
          />
          <button type="submit" className="btn-secondary h-9 py-0" disabled={!ok}>
            Adicionar
          </button>
        </form>
      ) : null}
    </Section>
  )
}

function ChecklistSection({ card, disabled }: { card: ContentCard; disabled: boolean }) {
  const a = useContentActions()
  const [text, setText] = useState('')
  const { done, total } = checklistDone(card)
  if (disabled && total === 0) return null
  return (
    <Section
      icon={<SquareCheck className="size-4" />}
      title="Checklist"
      aside={
        total ? (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        ) : null
      }
    >
      {total ? (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-lime transition-[width] duration-300"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      ) : null}
      <ul className="flex flex-col">
        {card.checklist.map((item) => (
          <li
            key={item.id}
            className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-2"
          >
            <input
              type="checkbox"
              className="checkbox"
              checked={item.done}
              disabled={disabled}
              aria-label={item.text}
              onChange={(e) => a.patchCheck(card.id, item.id, { done: e.target.checked })}
            />
            <input
              className={`min-w-0 flex-1 bg-transparent py-1 text-sm outline-none ${item.done ? 'text-muted-foreground line-through' : ''}`}
              value={item.text}
              disabled={disabled}
              aria-label="Texto do item"
              onChange={(e) => a.patchCheck(card.id, item.id, { text: e.target.value })}
            />
            {!disabled ? (
              <button
                type="button"
                className="icon-btn size-6 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                aria-label={`Remover ${item.text}`}
                onClick={() => a.removeCheck(card.id, item.id)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!disabled ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            a.addCheck(card.id, text)
            setText('')
          }}
        >
          <input
            className="field h-9 py-0 text-sm"
            placeholder="Novo item (ex.: gravar, editar, capa)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Novo item da checklist"
          />
          <button type="submit" className="btn-ghost h-9 py-0" disabled={!text.trim()}>
            <Plus className="size-4" aria-hidden />
            <span className="sr-only">Adicionar item</span>
          </button>
        </form>
      ) : null}
    </Section>
  )
}

function PublishedUrl({ card, disabled }: { card: ContentCard; disabled: boolean }) {
  const a = useContentActions()
  const [draft, setDraft] = useState(card.publishedUrl)
  const ok = draft.trim() === '' || isHttpUrl(draft.trim())
  if (disabled)
    return card.publishedUrl ? (
      <a
        href={card.publishedUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold underline underline-offset-2"
      >
        Abrir o post
      </a>
    ) : (
      <p className="text-xs text-muted-foreground">Ainda sem link.</p>
    )
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        className="field h-9 py-0 text-sm"
        placeholder="Link do post no ar"
        value={draft}
        inputMode="url"
        aria-label="Link do post publicado"
        aria-invalid={!ok}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (ok && draft.trim() !== card.publishedUrl)
            a.updateCard(card.id, { publishedUrl: draft.trim() })
        }}
      />
      {card.publishedUrl ? (
        <a href={card.publishedUrl} target="_blank" rel="noreferrer" className="btn-ghost h-9 py-0">
          <ExternalLink className="size-4" aria-hidden /> Abrir
        </a>
      ) : null}
    </div>
  )
}

function Comments({
  card,
  people,
  meId,
  viaServer,
}: {
  card: ContentCard
  people: Person[]
  meId: string
  /** cliente não grava pelo commit: o comentário vai pela RPC de revisão */
  viaServer: boolean
}) {
  const a = useContentActions()
  const toast = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listEnd = useRef<HTMLLIElement>(null)
  const count = card.comments.length
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [count])
  return (
    <Section icon={<MessageSquare className="size-4" />} title="Comentários">
      {count ? (
        <ul className="mb-3 flex flex-col gap-3">
          {card.comments.map((c) => {
            const i = people.findIndex((p) => p.id === c.authorId)
            const p = people[i]
            return (
              <li key={c.id} className="flex gap-2.5">
                {p ? (
                  <Avatar person={p} index={i} size="md" />
                ) : (
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    ?
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-bold">{c.authorName || p?.name || 'Alguém'}</span>
                    <span className="text-muted-foreground">
                      {c.at
                        ? new Date(c.at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    {c.kind !== 'comentario' ? (
                      <ApprovalBadge state={c.kind === 'aprovado' ? 'aprovado' : 'ajuste'} />
                    ) : null}
                  </p>
                  <p
                    className={`mt-1 whitespace-pre-wrap rounded-xl rounded-tl-sm px-3 py-2 text-sm [overflow-wrap:anywhere] ${
                      c.kind === 'ajuste'
                        ? 'bg-pink-soft/70'
                        : c.kind === 'aprovado'
                          ? 'bg-lime-soft/70'
                          : 'bg-surface-2'
                    }`}
                  >
                    {c.text}
                  </p>
                  {c.authorId && c.authorId === meId && c.kind === 'comentario' ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-semibold text-muted-foreground hover:text-danger"
                      onClick={() => a.removeComment(card.id, c.id)}
                    >
                      Apagar
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
          <li ref={listEnd} aria-hidden />
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Nenhum comentário ainda. Use para alinhar ajustes sem sair do card.
        </p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          if (!viaServer) {
            a.addComment(card.id, text, meId)
            setText('')
            return
          }
          setSending(true)
          try {
            await reviewCard(card.id, 'comentario', text)
            setText('')
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Não consegui enviar', 'error')
          } finally {
            setSending(false)
          }
        }}
      >
        <AutoTextarea
          value={text}
          onChange={setText}
          minRows={1}
          placeholder="Escreva um comentário"
          aria-label="Novo comentário"
          className="field"
        />
        <button
          type="submit"
          className="btn-primary h-10 shrink-0 py-0"
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          <span className="sr-only">Enviar comentário</span>
        </button>
      </form>
    </Section>
  )
}
