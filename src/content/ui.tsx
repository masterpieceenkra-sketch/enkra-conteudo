import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  SquareCheck,
} from 'lucide-react'
import type { Label, Person } from '../data/types'
import { LABEL_COLOR_CLASS } from '../data/labels'
import { formatShort } from '../lib/dates'
import { isImage, isVideo, useSignedUrl } from './attachments'
import { APPROVAL_INFO, FORMAT_ICON, NETWORK_SHORT, SOLID, initials } from './visual'
import {
  FORMAT_LABEL,
  NETWORK_LABEL,
  checklistDone,
  type ApprovalState,
  type Campaign,
  type ContentCard,
  type ContentFormat,
  type Network,
} from './model'

export function NetworkTag({ network }: { network: Network }) {
  return (
    <span
      title={NETWORK_LABEL[network]}
      className="inline-flex h-4 items-center rounded-[4px] border border-border px-1 font-mono text-[9px] font-bold leading-none tracking-wider text-muted-foreground"
    >
      {NETWORK_SHORT[network]}
    </span>
  )
}

export function FormatTag({ format }: { format: ContentFormat }) {
  const Icon = FORMAT_ICON[format]
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
      <Icon className="size-3.5" strokeWidth={2.2} aria-hidden />
      {FORMAT_LABEL[format]}
    </span>
  )
}

const AVATAR_TONES = [
  'bg-primary text-primary-foreground',
  'bg-blue text-blue-foreground',
  'bg-aqua text-aqua-foreground',
  'bg-lime text-lime-foreground',
  'bg-secondary text-secondary-foreground',
]

export function Avatar({
  person,
  index,
  size = 'sm',
}: {
  person: Person
  index: number
  size?: 'sm' | 'md'
}) {
  return (
    <span
      title={person.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-surface ${
        AVATAR_TONES[index % AVATAR_TONES.length]
      } ${size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs'}`}
    >
      {initials(person.name)}
    </span>
  )
}

export function AvatarStack({ ids, people }: { ids: string[]; people: Person[] }) {
  const list = ids
    .map((id) => ({ p: people.find((x) => x.id === id), i: people.findIndex((x) => x.id === id) }))
    .filter((x): x is { p: Person; i: number } => !!x.p)
  if (list.length === 0) return null
  return (
    <span className="flex -space-x-1.5">
      {list.slice(0, 3).map(({ p, i }) => (
        <Avatar key={p.id} person={p} index={i} />
      ))}
      {list.length > 3 ? (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold ring-2 ring-surface">
          +{list.length - 3}
        </span>
      ) : null}
    </span>
  )
}

export function ApprovalBadge({ state }: { state: ApprovalState }) {
  const info = APPROVAL_INFO[state]
  const Icon = state === 'aprovado' ? CheckCircle2 : state === 'ajuste' ? AlertCircle : Clock
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${info.cls}`}
    >
      <Icon className="size-3" aria-hidden /> {info.label}
    </span>
  )
}

/** Miniatura do anexo de capa: imagem, primeiro quadro do vídeo, ou nada. */
export function Cover({ card, className = '' }: { card: ContentCard; className?: string }) {
  const att = card.attachments.find((a) => a.id === card.coverId)
  const url = useSignedUrl(att?.path)
  if (!att) return null
  if (!url) return <div className={`animate-pulse bg-muted ${className}`} aria-hidden />
  if (isVideo(att))
    return (
      <video
        src={`${url}#t=0.5`}
        muted
        playsInline
        preload="metadata"
        className={`bg-muted object-cover ${className}`}
        aria-hidden
      />
    )
  if (isImage(att))
    return <img src={url} alt="" loading="lazy" className={`bg-muted object-cover ${className}`} />
  return null
}

interface FaceProps {
  card: ContentCard
  labels: Label[]
  people: Person[]
  campaign?: Campaign
  today: string
  late: boolean
  compact?: boolean
}

/** A face do card no quadro: tudo o que dá para saber sem abrir, em três linhas no máximo. */
export function CardFace({ card, labels, people, campaign, today, late, compact }: FaceProps) {
  const cl = checklistDone(card)
  const cardLabels = card.labelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => !!l)
  const date = card.publishAt
  // aprovado já está dito pela coluna; o selo só aparece quando pede atenção
  const approval = card.approval && card.approval.state !== 'aprovado' ? card.approval.state : null
  const Icon = FORMAT_ICON[card.format]
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-px group-hover:border-muted-foreground/40 group-hover:shadow-lg">
      {!compact && card.coverId ? <Cover card={card} className="aspect-[4/3] w-full" /> : null}
      <div className="flex flex-col gap-2 p-3">
        {cardLabels.length || approval ? (
          <div className="flex flex-wrap items-center gap-1">
            {approval ? <ApprovalBadge state={approval} /> : null}
            {cardLabels.map((l) => (
              <span
                key={l.id}
                className={`inline-flex h-4 items-center rounded-[4px] px-1.5 text-[9px] font-bold uppercase tracking-wider ${LABEL_COLOR_CLASS[l.color]}`}
              >
                {l.name}
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-[13.5px] font-semibold leading-snug tracking-[-0.005em] text-foreground [overflow-wrap:anywhere]">
          {card.title || <span className="text-muted-foreground">Sem título</span>}
        </p>
        {campaign ? (
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span
              className={`size-1.5 shrink-0 rounded-full ${SOLID[campaign.color]}`}
              aria-hidden
            />
            <span className="truncate">{campaign.name}</span>
          </p>
        ) : null}
        <div className="flex min-h-6 items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={FORMAT_LABEL[card.format]}>
            <Icon className="size-3.5" strokeWidth={2.2} aria-hidden />
            <span className="sr-only">{FORMAT_LABEL[card.format]}</span>
          </span>
          {card.networks.map((n) => (
            <NetworkTag key={n} network={n} />
          ))}
          {date ? (
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 tabular-nums ${
                late
                  ? 'bg-danger text-danger-foreground'
                  : date === today
                    ? 'bg-lime text-lime-foreground'
                    : 'bg-muted text-foreground'
              }`}
              title="Data de publicação"
            >
              {formatShort(date)}
              {card.publishTime ? ` · ${card.publishTime}` : ''}
            </span>
          ) : null}
          {cl.total ? (
            <span
              className={`inline-flex items-center gap-0.5 ${cl.done === cl.total ? 'text-foreground' : ''}`}
            >
              <SquareCheck className="size-3.5" aria-hidden /> {cl.done}/{cl.total}
            </span>
          ) : null}
          {card.comments.length ? (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="size-3.5" aria-hidden /> {card.comments.length}
            </span>
          ) : null}
          {card.attachments.length ? (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="size-3.5" aria-hidden /> {card.attachments.length}
            </span>
          ) : null}
          <span className="ml-auto">
            <AvatarStack ids={card.ownerIds} people={people} />
          </span>
        </div>
      </div>
    </div>
  )
}
