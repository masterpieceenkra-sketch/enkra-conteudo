import type { ContentState } from '../content/model'
import type { MessageKind } from './messageTemplates'

export const AREA_NAMES = [
  'ESTRATÉGIA',
  'OPERAÇÃO',
  'CONTEÚDO',
  'DESIGN',
  'TRÁFEGO',
  'COPY',
  'AUDIOVISUAL',
  'ATENDIMENTO',
] as const

export type AreaName = (typeof AREA_NAMES)[number]

/** Semente estática: sem estado, só estrutura. */
export interface PhaseTemplate {
  id: string
  name: string
  areas: { name: string; tasks: { id: string; label: string; owner?: string }[] }[]
}

export const LABEL_COLORS = ['pink', 'blue', 'aqua', 'lime', 'black', 'gray'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

/** Etiqueta definida no nível do lançamento (como no Trello) e referenciada pelas tarefas. */
export interface Label {
  id: string
  name: string
  color: LabelColor
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/** Uma checklist dentro de um card, com título próprio e itens. */
export interface TaskChecklist {
  id: string
  title: string
  items: ChecklistItem[]
}

/** Estado vivo (editável e persistido). */
export interface Task {
  id: string
  label: string
  done: boolean
  owner: string
  /** id de Person do responsável principal (o primeiro de `ownerIds`) */
  ownerId?: string
  /** ids de Person de todos os responsáveis; `owner` é o texto com os nomes */
  ownerIds?: string[]
  /** ISO yyyy-mm-dd ou vazio */
  due: string
  /** true quando criada pelo usuário (não faz parte do modelo) */
  custom?: boolean
  /** ids de Label (estado.labels) */
  labelIds?: string[]
  /** URL http(s) ou vazio */
  link?: string
  description?: string
  checklists?: TaskChecklist[]
}

export interface Area {
  id: string
  name: string
  tasks: Task[]
}

export interface Phase {
  id: string
  name: string
  /** yyyy-mm-dd; vazio quando a fase não tem data (quadro sem cronograma) */
  start: string
  /** yyyy-mm-dd; vazio quando a fase não tem data */
  end: string
  areas: Area[]
}

/** Uma fase só entra no calendário, no Gantt e na linha do tempo se tiver as duas datas. */
export function phaseHasDates(p: Pick<Phase, 'start' | 'end'>): boolean {
  return p.start !== '' && p.end !== ''
}

export interface Milestone {
  id: string
  label: string
  date: string
}

/** Pessoa do time cadastrada no app: vira opção de responsável e recebe notificações. */
export interface Person {
  id: string
  name: string
  email: string
  /** número principal, só dígitos, com DDI (5585999990000); é sempre `phones[0]` */
  phone: string
  /** todos os números da pessoa (o primeiro é o principal); entram no login e nos avisos */
  phones?: string[]
  /** cargo ou função no lançamento (ex.: Copywriter, Gestor de tráfego) */
  role?: string
  /** recebe avisos no WhatsApp */
  notify: boolean
  /** administra o cadastro (Usuários) e os avisos; só admin vê essa tela */
  admin?: boolean
  /** cuida do dinheiro: recebe os custos publicados e aprova ou reprova (só entre admins) */
  finance?: boolean
  /** cliente do hub de conteúdo: vê o quadro e aprova ou pede ajuste; não edita (nunca é admin) */
  client?: boolean
}

/** Reunião do lançamento: aparece no painel e no calendário, com pauta. */
export interface Meeting {
  id: string
  title: string
  /** ISO yyyy-mm-dd */
  date: string
  /** HH:mm ou vazio (dia inteiro) */
  time: string
  /** duração em minutos */
  durationMin: number
  /** URL http(s) da chamada, ou vazio */
  link: string
  /** pauta / descrição */
  agenda: string
  /** resumo colado depois da reunião (ex.: ata do Tactiq); abre em "Ver resumo" */
  summary?: string
  /** ids de Person que devem ser avisados */
  attendeeIds?: string[]
}

export interface NotificationPrefs {
  /** aviso quando uma tarefa é atribuída a alguém do cadastro */
  taskAssigned: boolean
  /** dentro de "tarefa atribuída": só avisa se a tarefa já tiver prazo definido */
  taskAssignedRequireDue: boolean
  /** lembrete às 9h do dia anterior ao prazo */
  dueTomorrow: boolean
  /** lembrete às 9h do próprio dia do prazo */
  dueToday: boolean
  /** cobrança às 9h enquanto a tarefa estiver com o prazo vencido */
  overdue: boolean
  /** de quantos em quantos dias a cobrança de atraso se repete */
  overdueEveryDays: number
  /** hora do dia (0-23, horário de Brasília) em que a cobrança de atraso sai */
  overdueHour: number
  /** aviso para o responsável quando a tarefa é marcada como feita */
  taskDone: boolean
  /** avisa o financeiro quando um custo é publicado */
  costNew: boolean
  /** avisa quem publicou quando o custo é aprovado ou reprovado */
  costDecision: boolean
  /** conteúdo: aviso quando alguém vira responsável por um card */
  cardAssigned: boolean
  /** conteúdo: lembrete às 9h, na véspera e no dia do prazo de produção */
  cardDue: boolean
  /** conteúdo: avisa o cliente quando há card esperando aprovação */
  contentReview: boolean
  /** conteúdo: avisa os responsáveis quando o cliente aprova ou pede ajuste */
  contentDecision: boolean
  /** conteúdo: avisa os responsáveis de um comentário novo no card */
  contentComment: boolean
  /** conteúdo: às 9h, lembra o responsável do que publica no dia */
  contentPublishToday: boolean
}

/** Intervalos possíveis da cobrança de tarefa atrasada, em dias. */
export const OVERDUE_EVERY_OPTIONS = [1, 2, 3, 7] as const

/** Horários possíveis da cobrança de tarefa atrasada (hora cheia, horário de Brasília). */
export const OVERDUE_HOUR_OPTIONS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  taskAssigned: true,
  taskAssignedRequireDue: false,
  dueTomorrow: true,
  dueToday: true,
  overdue: true,
  overdueEveryDays: 1,
  overdueHour: 9,
  taskDone: true,
  costNew: true,
  costDecision: true,
  cardAssigned: true,
  cardDue: true,
  contentReview: true,
  contentDecision: true,
  contentComment: true,
  contentPublishToday: false,
}

/** Nome de cada preferência no histórico e nos avisos da interface. */
export const NOTIFICATION_PREF_LABELS: Record<keyof NotificationPrefs, string> = {
  taskAssigned: 'Tarefa atribuída',
  taskAssignedRequireDue: 'Tarefa atribuída: só com prazo',
  dueTomorrow: 'Lembrete 1 dia antes do prazo',
  dueToday: 'Lembrete no dia do prazo',
  overdue: 'Cobrança de tarefa atrasada',
  overdueEveryDays: 'Cobrança de tarefa atrasada',
  overdueHour: 'Cobrança de tarefa atrasada',
  taskDone: 'Aviso de tarefa concluída',
  costNew: 'Custo publicado',
  costDecision: 'Decisão sobre o custo',
  cardAssigned: 'Card atribuído',
  cardDue: 'Prazo de produção',
  contentReview: 'Conteúdo para aprovar',
  contentDecision: 'Decisão do cliente',
  contentComment: 'Comentário no card',
  contentPublishToday: 'Publica hoje',
}

/** Modelo do quadro: decide o que nasce dentro dele e quais telas fazem sentido. */
export type BoardKind = 'launch' | 'sprint' | 'blank' | 'content'

/** Modelos oferecidos na criação de quadro do Enkra Hub (conteúdo nasce no app de conteúdo). */
export const BOARD_KINDS: BoardKind[] = ['launch', 'sprint', 'blank']

export const BOARD_KIND_INFO: Record<BoardKind, { title: string; hint: string }> = {
  launch: {
    title: 'Lançamento',
    hint: 'Fases de lançamento com datas, marcos (CPL, carrinho), brief completo e verificador anti-golpe.',
  },
  sprint: {
    title: 'Sprint semanal',
    hint: 'Backlog, sprint atual, próxima e concluído. Sem datas de fase e sem marcos.',
  },
  blank: {
    title: 'Em branco',
    hint: 'Uma fase e uma área. Você monta a estrutura do zero.',
  },
  content: {
    title: 'Conteúdo',
    hint: 'Social media: ideias, produção, aprovação do cliente, calendário e campanhas.',
  },
}

export interface LaunchState {
  version: 2
  /** Nome do quadro na interface e nos avisos; vazio usa o nome padrão do app */
  name?: string
  /** Modelo do quadro; ausente = lançamento (todo estado antigo é de lançamento) */
  kind?: BoardKind
  /** URL deste quadro, gravada pelo servidor ao criar; usada nos links das mensagens */
  url?: string
  /** Ligado na primeira vez que alguém cria, apaga ou move uma fase: o modelo para de ser reaplicado */
  phasesCustom?: boolean
  /** Data de início do lançamento (yyyy-mm-dd). Base do calendário padrão. */
  launchStart: string
  brief: Record<string, string>
  phases: Phase[]
  /** Etiquetas disponíveis para as tarefas */
  labels: Label[]
  milestones: Milestone[]
  meetings: Meeting[]
  /** Time cadastrado (menu ⋮ → Usuários) */
  people: Person[]
  /** Quais avisos automáticos saem no WhatsApp (boas-vindas é sempre automático) */
  notifications: NotificationPrefs
  /** Texto de cada aviso, com placeholders; ausente = padrão (ver data/messageTemplates) */
  messages?: Partial<Record<MessageKind, string>>
  /** chave `${phaseId}:${areaName}` */
  diary: Record<string, string>
  /** Quadro de conteúdo (kind = 'content'): colunas, campanhas, cards e estratégia */
  content?: ContentState
  updatedAt: string
}
