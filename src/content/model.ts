/**
 * Hub de conteúdo: o que vive dentro de `LaunchState.content` num quadro `kind: 'content'`.
 *
 * Tudo aqui é puro (tipos, padrões, leitura defensiva e redutores), para ser testado sem React
 * e reaplicado pelo SyncEngine quando o servidor muda no meio de uma edição.
 * A ordem dos cards dentro de uma coluna é a ordem do array `cards`.
 */
import type { LabelColor } from '../data/types'
import { isHttpUrl, isLabelColor } from '../data/labels'
import { isValidIso } from '../lib/dates'

// ---------- tipos ----------

/** O que a coluna significa no fluxo; decide calendário, grade do feed e atrasos. */
export type ColumnStage =
  'idea' | 'approved' | 'production' | 'review' | 'scheduled' | 'published' | 'custom'

export interface ContentColumn {
  id: string
  name: string
  color: LabelColor
  stage: ColumnStage
  /** o cliente aprova ou pede ajuste nesta coluna; aprovar leva o card para a próxima */
  clientApproves: boolean
}

export const FORMATS = ['reels', 'carrossel', 'estatico', 'stories', 'video', 'outro'] as const
export type ContentFormat = (typeof FORMATS)[number]

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  reels: 'Reels',
  carrossel: 'Carrossel',
  estatico: 'Estático',
  stories: 'Stories',
  video: 'Vídeo longo',
  outro: 'Outro',
}

export const NETWORKS = [
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'facebook',
  'threads',
] as const
export type Network = (typeof NETWORKS)[number]

export const NETWORK_LABEL: Record<Network, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  threads: 'Threads',
}

export interface Campaign {
  id: string
  name: string
  color: LabelColor
  /** yyyy-mm-dd ou vazio */
  start: string
  end: string
  objective: string
  notes: string
}

export interface Attachment {
  id: string
  /** caminho no bucket `content-attachments` (nunca uma URL: a URL é assinada na hora) */
  path: string
  name: string
  size: number
  mime: string
}

export interface CardLink {
  id: string
  label: string
  url: string
}

export interface CardCheckItem {
  id: string
  text: string
  done: boolean
}

export type CommentKind = 'comentario' | 'aprovado' | 'ajuste'

export interface CardComment {
  id: string
  authorId: string
  authorName: string
  text: string
  /** ISO datetime */
  at: string
  kind: CommentKind
}

export type ApprovalState = 'pendente' | 'aprovado' | 'ajuste'

export interface Approval {
  state: ApprovalState
  byName?: string
  at?: string
  note?: string
}

export interface ContentCard {
  id: string
  title: string
  columnId: string
  campaignId: string
  format: ContentFormat
  networks: Network[]
  pillarId: string
  seriesId: string
  /** data de publicação yyyy-mm-dd ou vazio */
  publishAt: string
  /** HH:mm ou vazio */
  publishTime: string
  /** prazo de produção yyyy-mm-dd ou vazio */
  due: string
  ownerIds: string[]
  labelIds: string[]
  /** descrição, roteiro, referência */
  briefing: string
  /** legenda do post */
  caption: string
  attachments: Attachment[]
  /** id do anexo usado como capa (miniatura no quadro e na grade do feed) */
  coverId: string
  links: CardLink[]
  checklist: CardCheckItem[]
  comments: CardComment[]
  approval?: Approval
  publishedUrl: string
  /** yyyy-mm-dd em que o card entrou em Publicado (conta na meta); vazio fora de Publicado */
  publishedAt: string
  createdAt: string
  createdBy: string
}

export type FunnelStage = 'topo' | 'meio' | 'fundo'

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  topo: 'Topo · Alcance',
  meio: 'Meio · Autoridade',
  fundo: 'Fundo · Conversão',
}

export interface StrategyItem {
  id: string
  title: string
  text: string
}

export interface Pillar {
  id: string
  stage: FunnelStage
  name: string
  goal: string
  /** formatos e pautas que alimentam o pilar, um por linha */
  ideas: string
}

export interface Series {
  id: string
  name: string
  kind: string
  description: string
}

export interface CadenceGoal {
  format: ContentFormat
  perWeek: number
}

export interface Strategy {
  /** resumo de posicionamento, no topo da página */
  summary: string
  /** quem é: camadas (negócio, pessoal, estilo) */
  persona: (StrategyItem & { group: string })[]
  personaNote: string
  pillars: Pillar[]
  formats: StrategyItem[]
  series: Series[]
  cadence: CadenceGoal[]
  cadenceNote: string
  /** posts fixados do perfil */
  pinned: StrategyItem[]
}

export interface ContentState {
  columns: ContentColumn[]
  campaigns: Campaign[]
  cards: ContentCard[]
  strategy: Strategy
}

// ---------- limites ----------

export const LIMITS = {
  title: 200,
  briefing: 20_000,
  caption: 5_000,
  comment: 4_000,
  comments: 300,
  attachments: 30,
  links: 20,
  checklist: 100,
  columns: 12,
  cards: 3_000,
  campaigns: 200,
  shortText: 300,
  longText: 8_000,
}

/** Tamanho máximo de um anexo (limite do Storage no plano atual). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

// ---------- padrões ----------

export const DEFAULT_COLUMNS: ContentColumn[] = [
  { id: 'c-ideias', name: 'Ideias', color: 'gray', stage: 'idea', clientApproves: true },
  { id: 'c-aprovado', name: 'Aprovado', color: 'lime', stage: 'approved', clientApproves: false },
  {
    id: 'c-producao',
    name: 'Em produção',
    color: 'aqua',
    stage: 'production',
    clientApproves: false,
  },
  { id: 'c-revisao', name: 'Em revisão', color: 'blue', stage: 'review', clientApproves: true },
  {
    id: 'c-programado',
    name: 'Programado',
    color: 'pink',
    stage: 'scheduled',
    clientApproves: false,
  },
  {
    id: 'c-publicado',
    name: 'Publicado',
    color: 'black',
    stage: 'published',
    clientApproves: false,
  },
]

export function emptyStrategy(): Strategy {
  return {
    summary: '',
    persona: [],
    personaNote: '',
    pillars: [
      { id: 'pl-topo', stage: 'topo', name: 'Alcance', goal: '', ideas: '' },
      { id: 'pl-meio', stage: 'meio', name: 'Autoridade', goal: '', ideas: '' },
      { id: 'pl-fundo', stage: 'fundo', name: 'Conversão', goal: '', ideas: '' },
    ],
    formats: [],
    series: [],
    cadence: [],
    cadenceNote: '',
    pinned: [],
  }
}

export function defaultContent(): ContentState {
  return {
    columns: DEFAULT_COLUMNS.map((c) => ({ ...c })),
    campaigns: [],
    cards: [],
    strategy: emptyStrategy(),
  }
}

export function blankCard(id: string, columnId: string, createdBy: string): ContentCard {
  return {
    id,
    title: '',
    columnId,
    campaignId: '',
    format: 'reels',
    networks: ['instagram'],
    pillarId: '',
    seriesId: '',
    publishAt: '',
    publishTime: '',
    due: '',
    ownerIds: [],
    labelIds: [],
    briefing: '',
    caption: '',
    attachments: [],
    coverId: '',
    links: [],
    checklist: [],
    comments: [],
    publishedUrl: '',
    publishedAt: '',
    createdAt: new Date().toISOString(),
    createdBy,
  }
}

// ---------- leitura defensiva ----------

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')
const id = (v: unknown): string =>
  typeof v === 'string' && v.length > 0 && v.length <= 80 ? v : ''
const iso = (v: unknown): string => (typeof v === 'string' && isValidIso(v) ? v : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const time = (v: unknown): string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : ''
const color = (v: unknown, fallback: LabelColor): LabelColor => (isLabelColor(v) ? v : fallback)
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback
const uniqueIds = <T extends { id: string }>(list: T[]): T[] => {
  const seen = new Set<string>()
  return list.filter((x) => x.id !== '' && !seen.has(x.id) && (seen.add(x.id), true))
}

const STAGES: readonly ColumnStage[] = [
  'idea',
  'approved',
  'production',
  'review',
  'scheduled',
  'published',
  'custom',
]

function parseColumns(raw: unknown): ContentColumn[] {
  const cols = uniqueIds(
    arr(raw)
      .slice(0, LIMITS.columns)
      .map((c) => {
        const o = obj(c)
        return {
          id: id(o.id),
          name: str(o.name, 60).trim() || 'Coluna',
          color: color(o.color, 'gray'),
          stage: oneOf(o.stage, STAGES, 'custom'),
          clientApproves: o.clientApproves === true,
        }
      }),
  )
  return cols.length ? cols : DEFAULT_COLUMNS.map((c) => ({ ...c }))
}

function parseCampaigns(raw: unknown): Campaign[] {
  return uniqueIds(
    arr(raw)
      .slice(0, LIMITS.campaigns)
      .map((c) => {
        const o = obj(c)
        const start = iso(o.start)
        let end = iso(o.end)
        if (start && end && end < start) end = start
        return {
          id: id(o.id),
          name: str(o.name, 120).trim() || 'Campanha',
          color: color(o.color, 'pink'),
          start,
          end,
          objective: str(o.objective, LIMITS.shortText * 2),
          notes: str(o.notes, LIMITS.longText),
        }
      }),
  )
}

function parseCard(raw: unknown, columnIds: Set<string>, firstColumn: string): ContentCard | null {
  const o = obj(raw)
  const cardId = id(o.id)
  if (!cardId) return null
  const attachments = uniqueIds(
    arr(o.attachments)
      .slice(0, LIMITS.attachments)
      .map((a) => {
        const x = obj(a)
        return {
          id: id(x.id),
          path: str(x.path, 400),
          name: str(x.name, 200) || 'arquivo',
          size: typeof x.size === 'number' && x.size >= 0 ? Math.round(x.size) : 0,
          mime: str(x.mime, 120),
        }
      })
      .filter((a) => a.path !== ''),
  )
  const coverId = id(o.coverId)
  const approval = obj(o.approval)
  const approvalState = oneOf<ApprovalState | ''>(
    approval.state,
    ['pendente', 'aprovado', 'ajuste'],
    '',
  )
  return {
    id: cardId,
    title: str(o.title, LIMITS.title),
    columnId: columnIds.has(o.columnId as string) ? (o.columnId as string) : firstColumn,
    campaignId: id(o.campaignId),
    format: oneOf(o.format, FORMATS, 'outro'),
    networks: [
      ...new Set(
        arr(o.networks).filter((n): n is Network => oneOf(n, NETWORKS, 'instagram') === n),
      ),
    ],
    pillarId: id(o.pillarId),
    seriesId: id(o.seriesId),
    publishAt: iso(o.publishAt),
    publishTime: time(o.publishTime),
    due: iso(o.due),
    ownerIds: [...new Set(arr(o.ownerIds).map(id).filter(Boolean))],
    labelIds: [...new Set(arr(o.labelIds).map(id).filter(Boolean))],
    briefing: str(o.briefing, LIMITS.briefing),
    caption: str(o.caption, LIMITS.caption),
    attachments,
    coverId: attachments.some((a) => a.id === coverId) ? coverId : '',
    links: uniqueIds(
      arr(o.links)
        .slice(0, LIMITS.links)
        .map((l) => {
          const x = obj(l)
          return { id: id(x.id), label: str(x.label, 120), url: str(x.url, 1000) }
        })
        .filter((l) => isHttpUrl(l.url)),
    ),
    checklist: uniqueIds(
      arr(o.checklist)
        .slice(0, LIMITS.checklist)
        .map((c) => {
          const x = obj(c)
          return { id: id(x.id), text: str(x.text, LIMITS.shortText), done: x.done === true }
        }),
    ),
    comments: uniqueIds(
      arr(o.comments)
        .slice(-LIMITS.comments)
        .map((c) => {
          const x = obj(c)
          return {
            id: id(x.id),
            authorId: id(x.authorId),
            authorName: str(x.authorName, 80),
            text: str(x.text, LIMITS.comment),
            at: str(x.at, 40),
            kind: oneOf<CommentKind>(x.kind, ['comentario', 'aprovado', 'ajuste'], 'comentario'),
          }
        }),
    ),
    ...(approvalState
      ? {
          approval: {
            state: approvalState,
            ...(approval.byName ? { byName: str(approval.byName, 80) } : {}),
            ...(approval.at ? { at: str(approval.at, 40) } : {}),
            ...(approval.note ? { note: str(approval.note, LIMITS.comment) } : {}),
          },
        }
      : {}),
    publishedUrl: isHttpUrl(str(o.publishedUrl, 1000)) ? str(o.publishedUrl, 1000) : '',
    publishedAt: iso(o.publishedAt),
    createdAt: str(o.createdAt, 40),
    createdBy: str(o.createdBy, 80),
  }
}

function parseItems(raw: unknown, max = 60): StrategyItem[] {
  return uniqueIds(
    arr(raw)
      .slice(0, max)
      .map((x) => {
        const o = obj(x)
        return { id: id(o.id), title: str(o.title, 120), text: str(o.text, LIMITS.longText) }
      }),
  )
}

export function parseStrategy(raw: unknown): Strategy {
  const o = obj(raw)
  const base = emptyStrategy()
  const pillars = uniqueIds(
    arr(o.pillars)
      .slice(0, 30)
      .map((x) => {
        const p = obj(x)
        return {
          id: id(p.id),
          stage: oneOf<FunnelStage>(p.stage, ['topo', 'meio', 'fundo'], 'topo'),
          name: str(p.name, 80),
          goal: str(p.goal, LIMITS.shortText),
          ideas: str(p.ideas, LIMITS.longText),
        }
      }),
  )
  return {
    summary: str(o.summary, LIMITS.longText),
    persona: uniqueIds(
      arr(o.persona)
        .slice(0, 60)
        .map((x) => {
          const p = obj(x)
          return {
            id: id(p.id),
            group: str(p.group, 40),
            title: str(p.title, 80),
            text: str(p.text, LIMITS.shortText),
          }
        }),
    ),
    personaNote: str(o.personaNote, LIMITS.longText),
    pillars: Array.isArray(o.pillars) ? pillars : base.pillars,
    formats: parseItems(o.formats),
    series: uniqueIds(
      arr(o.series)
        .slice(0, 60)
        .map((x) => {
          const p = obj(x)
          return {
            id: id(p.id),
            name: str(p.name, 120),
            kind: str(p.kind, 40),
            description: str(p.description, LIMITS.longText),
          }
        }),
    ),
    cadence: arr(o.cadence)
      .map((x) => {
        const p = obj(x)
        const n = typeof p.perWeek === 'number' ? Math.round(p.perWeek) : 0
        return { format: oneOf(p.format, FORMATS, 'outro'), perWeek: Math.min(Math.max(n, 0), 70) }
      })
      .filter((c, i, all) => all.findIndex((x) => x.format === c.format) === i),
    cadenceNote: str(o.cadenceNote, LIMITS.longText),
    pinned: parseItems(o.pinned, 12),
  }
}

/** Aceita qualquer JSON e devolve um ContentState válido (colunas padrão se faltar). */
export function parseContent(raw: unknown): ContentState {
  const o = obj(raw)
  const columns = parseColumns(o.columns)
  const columnIds = new Set(columns.map((c) => c.id))
  const cards = arr(o.cards)
    .slice(0, LIMITS.cards)
    .map((c) => parseCard(c, columnIds, columns[0].id))
    .filter((c): c is ContentCard => c !== null)
  return {
    columns,
    campaigns: parseCampaigns(o.campaigns),
    cards: uniqueIds(cards),
    strategy: parseStrategy(o.strategy),
  }
}

// ---------- redutores ----------

export function cardsIn(c: ContentState, columnId: string): ContentCard[] {
  return c.cards.filter((k) => k.columnId === columnId)
}

export function patchCard(
  c: ContentState,
  cardId: string,
  patch: Partial<Omit<ContentCard, 'id'>>,
): ContentState {
  let changed = false
  const cards = c.cards.map((k) => {
    if (k.id !== cardId) return k
    changed = true
    return { ...k, ...patch }
  })
  return changed ? { ...c, cards } : c
}

/** Card novo no fim da coluna (ou no começo, com `atStart`). */
export function addCard(c: ContentState, card: ContentCard, atStart = false): ContentState {
  if (c.cards.length >= LIMITS.cards) return c
  if (!c.columns.some((col) => col.id === card.columnId)) return c
  if (!atStart) return { ...c, cards: [...c.cards, card] }
  const first = c.cards.findIndex((k) => k.columnId === card.columnId)
  const cards = [...c.cards]
  cards.splice(first === -1 ? cards.length : first, 0, card)
  return { ...c, cards }
}

/**
 * Leva o card para a coluna `toColumnId`, na posição `toIndex` entre os cards dela
 * (contando sem ele). Índice além do fim coloca no fim.
 */
export function moveCard(
  c: ContentState,
  cardId: string,
  toColumnId: string,
  toIndex: number,
): ContentState {
  const card = c.cards.find((k) => k.id === cardId)
  if (!card || !c.columns.some((col) => col.id === toColumnId)) return c
  const rest = c.cards.filter((k) => k.id !== cardId)
  const inTarget = rest.filter((k) => k.columnId === toColumnId)
  const index = Math.min(Math.max(0, toIndex), inTarget.length)
  // mesmo lugar de antes: nada muda (evita gravação à toa ao soltar onde pegou)
  if (card.columnId === toColumnId && cardsIn(c, toColumnId).indexOf(card) === index) return c
  let at: number
  if (inTarget.length === 0) at = rest.length
  else if (index >= inTarget.length) at = rest.indexOf(inTarget[inTarget.length - 1]) + 1
  else at = rest.indexOf(inTarget[index])
  const cards = [...rest]
  cards.splice(at, 0, card.columnId === toColumnId ? card : { ...card, columnId: toColumnId })
  return { ...c, cards }
}

export function removeCard(c: ContentState, cardId: string): ContentState {
  const cards = c.cards.filter((k) => k.id !== cardId)
  return cards.length === c.cards.length ? c : { ...c, cards }
}

/** Cópia logo abaixo do original, sem comentários nem aprovação. */
export function duplicateCard(
  c: ContentState,
  cardId: string,
  newCardId: string,
  createdBy: string,
): ContentState {
  const i = c.cards.findIndex((k) => k.id === cardId)
  if (i === -1 || c.cards.length >= LIMITS.cards) return c
  const src = c.cards[i]
  const copy: ContentCard = {
    ...src,
    id: newCardId,
    title: `${src.title} (cópia)`.slice(0, LIMITS.title),
    checklist: src.checklist.map((x) => ({ ...x, done: false })),
    comments: [],
    approval: undefined,
    publishedUrl: '',
    publishedAt: '',
    createdAt: new Date().toISOString(),
    createdBy,
  }
  delete copy.approval
  const cards = [...c.cards]
  cards.splice(i + 1, 0, copy)
  return { ...c, cards }
}

export function addColumn(c: ContentState, col: ContentColumn): ContentState {
  if (c.columns.length >= LIMITS.columns) return c
  return { ...c, columns: [...c.columns, col] }
}

export function patchColumn(
  c: ContentState,
  columnId: string,
  patch: Partial<Omit<ContentColumn, 'id'>>,
): ContentState {
  return {
    ...c,
    columns: c.columns.map((col) => (col.id === columnId ? { ...col, ...patch } : col)),
  }
}

export function moveColumn(c: ContentState, columnId: string, delta: -1 | 1): ContentState {
  const i = c.columns.findIndex((col) => col.id === columnId)
  const j = i + delta
  if (i === -1 || j < 0 || j >= c.columns.length) return c
  const columns = [...c.columns]
  ;[columns[i], columns[j]] = [columns[j], columns[i]]
  return { ...c, columns }
}

/** Remove a coluna; os cards dela vão para a coluna vizinha (nunca some card). */
export function removeColumn(c: ContentState, columnId: string): ContentState {
  if (c.columns.length <= 1) return c
  const i = c.columns.findIndex((col) => col.id === columnId)
  if (i === -1) return c
  const target = c.columns[i === 0 ? 1 : i - 1].id
  return {
    ...c,
    columns: c.columns.filter((col) => col.id !== columnId),
    cards: c.cards.map((k) => (k.columnId === columnId ? { ...k, columnId: target } : k)),
  }
}

export function upsertCampaign(c: ContentState, campaign: Campaign): ContentState {
  const exists = c.campaigns.some((x) => x.id === campaign.id)
  if (!exists && c.campaigns.length >= LIMITS.campaigns) return c
  return {
    ...c,
    campaigns: exists
      ? c.campaigns.map((x) => (x.id === campaign.id ? campaign : x))
      : [...c.campaigns, campaign],
  }
}

/** Apaga a campanha; os cards dela ficam, só perdem o vínculo. */
export function removeCampaign(c: ContentState, campaignId: string): ContentState {
  return {
    ...c,
    campaigns: c.campaigns.filter((x) => x.id !== campaignId),
    cards: c.cards.map((k) => (k.campaignId === campaignId ? { ...k, campaignId: '' } : k)),
  }
}

/**
 * Aprovação acompanha a coluna: entrar numa coluna em que o cliente aprova abre uma rodada
 * nova ("aguardando cliente"); sair dela com a rodada ainda aberta cancela a rodada.
 * Aprovado e ajuste pedido ficam no card como histórico até a próxima rodada.
 */
export function withApprovalFor(c: ContentState, cardId: string, nowIso = ''): ContentState {
  const k = c.cards.find((x) => x.id === cardId)
  const col = k && c.columns.find((x) => x.id === k.columnId)
  if (!k || !col) return c
  if (col.clientApproves && k.approval?.state !== 'pendente')
    // `at` marca desde quando está com o cliente (tempo de espera no Analytics)
    return patchCard(c, cardId, {
      approval: { state: 'pendente', ...(nowIso ? { at: nowIso } : {}) },
    })
  if (!col.clientApproves && k.approval?.state === 'pendente') {
    const rest = { ...k }
    delete rest.approval
    return { ...c, cards: c.cards.map((x) => (x.id === cardId ? rest : x)) }
  }
  return c
}

/**
 * Data de publicação real: entrar em Publicado marca o dia (é o que conta na meta);
 * sair de Publicado apaga. Quem já tinha a data guarda a original.
 */
export function withPublishedFor(c: ContentState, cardId: string, today: string): ContentState {
  const k = c.cards.find((x) => x.id === cardId)
  const col = k && c.columns.find((x) => x.id === k.columnId)
  if (!k || !col) return c
  if (col.stage === 'published' && !k.publishedAt)
    return patchCard(c, cardId, { publishedAt: today })
  if (col.stage !== 'published' && k.publishedAt) return patchCard(c, cardId, { publishedAt: '' })
  return c
}

// ---------- leitura ----------

export function columnOf(c: ContentState, card: ContentCard): ContentColumn | undefined {
  return c.columns.find((col) => col.id === card.columnId)
}

/** Coluna seguinte (para onde o card vai quando o cliente aprova). */
export function nextColumn(c: ContentState, columnId: string): ContentColumn | undefined {
  const i = c.columns.findIndex((col) => col.id === columnId)
  return i === -1 ? undefined : c.columns[i + 1]
}

export function isPublished(c: ContentState, card: ContentCard): boolean {
  return columnOf(c, card)?.stage === 'published'
}

/** Passou da data de publicação e ainda não está em Publicado. */
export function isLate(c: ContentState, card: ContentCard, today: string): boolean {
  return card.publishAt !== '' && card.publishAt < today && !isPublished(c, card)
}

/** Prazo de produção vencido com o card ainda antes da revisão. */
export function isDueLate(c: ContentState, card: ContentCard, today: string): boolean {
  if (card.due === '' || card.due >= today) return false
  const stage = columnOf(c, card)?.stage
  return stage === 'idea' || stage === 'approved' || stage === 'production' || stage === 'custom'
}

export function checklistDone(card: ContentCard): { done: number; total: number } {
  return { done: card.checklist.filter((x) => x.done).length, total: card.checklist.length }
}

export interface CardFilter {
  q: string
  campaignId: string
  format: ContentFormat | ''
  network: Network | ''
  ownerId: string
  labelId: string
  pillarId: string
}

export const EMPTY_FILTER: CardFilter = {
  q: '',
  campaignId: '',
  format: '',
  network: '',
  ownerId: '',
  labelId: '',
  pillarId: '',
}

export function isFiltering(f: CardFilter): boolean {
  return Object.values(f).some((v) => v !== '')
}

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function matchesFilter(card: ContentCard, f: CardFilter): boolean {
  if (f.campaignId && card.campaignId !== f.campaignId) return false
  if (f.format && card.format !== f.format) return false
  if (f.network && !card.networks.includes(f.network)) return false
  if (f.ownerId && !card.ownerIds.includes(f.ownerId)) return false
  if (f.labelId && !card.labelIds.includes(f.labelId)) return false
  if (f.pillarId && card.pillarId !== f.pillarId) return false
  if (f.q.trim()) {
    const q = fold(f.q.trim())
    if (!fold(`${card.title} ${card.briefing} ${card.caption}`).includes(q)) return false
  }
  return true
}

/** Cards esperando o cliente: aprovação aberta numa coluna em que o cliente aprova. */
export function pendingReview(c: ContentState): ContentCard[] {
  return c.cards
    .filter((k) => k.approval?.state === 'pendente' && columnOf(c, k)?.clientApproves)
    .sort((a, b) => (a.publishAt || '9999').localeCompare(b.publishAt || '9999'))
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
