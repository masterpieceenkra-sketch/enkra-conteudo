/** Modelos das mensagens de WhatsApp, editáveis em Usuários › Configurar avisos. */

export const MESSAGE_KINDS = [
  'task_assigned',
  'task_update',
  'due_tomorrow',
  'due_today',
  'overdue',
  'task_done',
  'cost_new',
  'cost_decision',
  'meeting',
  'welcome',
  'card_assigned',
  'card_due',
  'content_review',
  'content_decision',
  'content_comment',
  'content_publish_today',
] as const

export type MessageKind = (typeof MESSAGE_KINDS)[number]

/** Avisos que fazem sentido em cada tipo de quadro (o painel de textos só mostra esses). */
export const LAUNCH_MESSAGE_KINDS: MessageKind[] = [
  'task_assigned',
  'task_update',
  'due_tomorrow',
  'due_today',
  'overdue',
  'task_done',
  'cost_new',
  'cost_decision',
  'meeting',
  'welcome',
]
export const CONTENT_MESSAGE_KINDS: MessageKind[] = [
  'card_assigned',
  'card_due',
  'content_review',
  'content_decision',
  'content_comment',
  'content_publish_today',
  'welcome',
]

export type MessageTemplates = Record<MessageKind, string>

export interface Placeholder {
  key: string
  label: string
}

const PAINEL: Placeholder = { key: 'painel', label: 'nome do quadro' }

const CARD_PLACEHOLDERS: Placeholder[] = [
  { key: 'nome', label: 'primeiro nome de quem recebe' },
  { key: 'conteudo', label: 'título do card' },
  { key: 'formato', label: 'formato (Reels, Carrossel…)' },
  { key: 'publicacao', label: 'data de publicação (dd/mm, com horário)' },
  { key: 'prazo', label: 'prazo de produção (dd/mm)' },
  { key: 'link', label: 'link do card' },
  PAINEL,
]

const TASK_PLACEHOLDERS: Placeholder[] = [
  { key: 'nome', label: 'primeiro nome de quem recebe' },
  { key: 'tarefa', label: 'nome da tarefa' },
  { key: 'prazo', label: 'prazo (dd/mm)' },
  { key: 'checklist', label: 'checklists do card, com os itens' },
  { key: 'link', label: 'link do card' },
  { key: 'autor', label: 'quem fez a ação' },
]

export const MESSAGE_KIND_INFO: Record<
  MessageKind,
  { title: string; hint: string; placeholders: Placeholder[] }
> = {
  task_assigned: {
    title: 'Tarefa atribuída',
    hint: 'Quando alguém do cadastro vira responsável por uma tarefa.',
    placeholders: TASK_PLACEHOLDERS,
  },
  task_update: {
    title: 'Tarefa atualizada',
    hint: 'Botão "Atualizar aviso" no card.',
    placeholders: TASK_PLACEHOLDERS,
  },
  due_tomorrow: {
    title: 'Prazo: 1 dia antes',
    hint: 'Às 9h do dia anterior ao prazo.',
    placeholders: TASK_PLACEHOLDERS.filter((p) => p.key !== 'autor'),
  },
  due_today: {
    title: 'Prazo: no mesmo dia',
    hint: 'Às 9h do dia do prazo.',
    placeholders: TASK_PLACEHOLDERS.filter((p) => p.key !== 'autor'),
  },
  overdue: {
    title: 'Tarefa atrasada',
    hint: 'Às 9h, enquanto o prazo estiver vencido, na frequência escolhida em Avisos automáticos.',
    placeholders: [
      ...TASK_PLACEHOLDERS.filter((p) => p.key !== 'autor'),
      { key: 'atraso', label: 'tempo de atraso (ex.: 3 dias)' },
    ],
  },
  task_done: {
    title: 'Tarefa concluída',
    hint: 'Quando alguém marca a tarefa como feita. Vai para os responsáveis, menos quem marcou.',
    placeholders: TASK_PLACEHOLDERS,
  },
  cost_new: {
    title: 'Custo publicado',
    hint: 'Quando alguém solicita um custo. Vai para quem está marcado como Financeiro em Usuários.',
    placeholders: [
      { key: 'nome', label: 'primeiro nome de quem recebe' },
      { key: 'custo', label: 'nome do custo' },
      { key: 'valor', label: 'valor em reais' },
      { key: 'frequencia', label: 'única, mensal, trimestral ou anual' },
      { key: 'categoria', label: 'categoria do custo' },
      { key: 'data', label: 'data do gasto (dd/mm)' },
      { key: 'obs', label: 'observações' },
      { key: 'link', label: 'link da tela de custos' },
      { key: 'autor', label: 'quem solicitou' },
    ],
  },
  cost_decision: {
    title: 'Custo aprovado ou reprovado',
    hint: 'Quando o financeiro decide. Vai para quem publicou o custo.',
    placeholders: [
      { key: 'nome', label: 'primeiro nome de quem recebe' },
      { key: 'custo', label: 'nome do custo' },
      { key: 'valor', label: 'valor em reais' },
      { key: 'decisao', label: '"aprovado ✅" ou "reprovado ❌"' },
      { key: 'justificativa', label: 'motivo escrito na reprovação' },
      { key: 'link', label: 'link da tela de custos' },
      { key: 'autor', label: 'quem decidiu' },
    ],
  },
  meeting: {
    title: 'Reunião',
    hint: 'Para os participantes escolhidos ao marcar ou alterar.',
    placeholders: [
      { key: 'nome', label: 'primeiro nome de quem recebe' },
      { key: 'reuniao', label: 'título da reunião' },
      { key: 'quando', label: 'data e hora (dd/mm às HH:mm)' },
      { key: 'link', label: 'link da chamada' },
      { key: 'autor', label: 'quem marcou' },
    ],
  },
  welcome: {
    title: 'Boas-vindas',
    hint: 'Uma vez por pessoa, ao entrar no cadastro.',
    placeholders: [
      { key: 'nome', label: 'primeiro nome de quem recebe' },
      { key: 'link', label: 'link do painel' },
      { key: 'autor', label: 'quem cadastrou (vazio quando a pessoa entrou sozinha)' },
      PAINEL,
    ],
  },
  card_assigned: {
    title: 'Card atribuído',
    hint: 'Quando alguém do time vira responsável por um conteúdo.',
    placeholders: [...CARD_PLACEHOLDERS, { key: 'autor', label: 'quem atribuiu' }],
  },
  card_due: {
    title: 'Prazo de produção',
    hint: 'Às 9h da véspera e do dia do prazo de produção, para os responsáveis.',
    placeholders: [...CARD_PLACEHOLDERS, { key: 'quando', label: '"amanhã" ou "hoje"' }],
  },
  content_review: {
    title: 'Conteúdo para aprovar',
    hint: 'Para quem é Cliente, quando cards entram numa coluna em que o cliente aprova. Vários de uma vez viram uma mensagem só.',
    placeholders: [
      { key: 'nome', label: 'primeiro nome de quem recebe' },
      { key: 'lista', label: 'os conteúdos, um por linha' },
      { key: 'link', label: 'link da tela de aprovação' },
      { key: 'autor', label: 'quem mandou para aprovação' },
      PAINEL,
    ],
  },
  content_decision: {
    title: 'Decisão do cliente',
    hint: 'Para os responsáveis do card, quando o cliente aprova ou pede ajuste.',
    placeholders: [
      ...CARD_PLACEHOLDERS,
      { key: 'decisao', label: '"aprovado ✅" ou "devolvido com ajuste ✏️"' },
      { key: 'comentario', label: 'o que o cliente escreveu' },
      { key: 'autor', label: 'quem decidiu' },
    ],
  },
  content_comment: {
    title: 'Comentário no card',
    hint: 'Para os responsáveis do card, menos quem comentou.',
    placeholders: [
      ...CARD_PLACEHOLDERS,
      { key: 'comentario', label: 'o comentário' },
      { key: 'autor', label: 'quem comentou' },
    ],
  },
  content_publish_today: {
    title: 'Publica hoje',
    hint: 'Às 9h, para os responsáveis do que tem publicação no dia e ainda não está em Publicado.',
    placeholders: CARD_PLACEHOLDERS,
  },
}

const TASK_BODY = `*Prazo: {prazo}.* ⏳

{checklist}

Abrir card em: {link}

{autor} · Comu HUB 👋`

const CARD_FOOTER = `Abrir card: {link}

{autor} · {painel} 👋`

/** Textos padrão do hub de conteúdo. */
const CONTENT_TEMPLATES = {
  card_assigned: `Olá, {nome}! Você ficou responsável pelo conteúdo *{conteudo}* ({formato}) no {painel}. 🎬

Publicação: {publicacao}
Prazo de produção: {prazo}

${CARD_FOOTER}`,
  card_due: `Olá, {nome}! O prazo de produção de *{conteudo}* vence {quando}. ⏰

Publicação: {publicacao}

Abrir card: {link}

{painel} 👋`,
  content_review: `Olá, {nome}! Tem conteúdo esperando a sua aprovação no {painel}. 👀

{lista}

Aprovar ou pedir ajuste: {link}

{autor} · {painel} 👋`,
  content_decision: `Olá, {nome}! O conteúdo *{conteudo}* foi {decisao} por {autor}.

Comentário: {comentario}

Abrir card: {link}

{painel} 👋`,
  content_comment: `Olá, {nome}! {autor} comentou em *{conteudo}*. 💬

{comentario}

Responder: {link}

{painel} 👋`,
  content_publish_today: `Olá, {nome}! Hoje é dia de publicar *{conteudo}* ({formato}). 🚀

Publicação: {publicacao}

Abrir card: {link}

{painel} 👋`,
}

/** Boas-vindas do hub de conteúdo (as do lançamento falam de checklist e reuniões). */
const CONTENT_WELCOME = `Olá, {nome}! 👋
Você foi cadastrado(a) no *{painel}*, o hub de conteúdo, por {autor}.
Por lá ficam o quadro, o calendário e os posts para aprovar. Quando um conteúdo for seu ou precisar da sua aprovação, eu te aviso por aqui.

Acesse: {link}`

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  task_assigned: `Olá, {nome}! Você ficou responsável por *{tarefa}* no Comu HUB. 🔥

${TASK_BODY}`,
  task_update: `Olá, {nome}! A tarefa *{tarefa}* foi atualizada no Comu HUB. 🔥

${TASK_BODY}`,
  due_tomorrow: `Olá, {nome}! Lembrete: a tarefa *{tarefa}* vence amanhã. ⏰

${TASK_BODY}`,
  due_today: `Olá, {nome}! Lembrete: a tarefa *{tarefa}* vence hoje. ⏰

${TASK_BODY}`,
  overdue: `Olá, {nome}! A tarefa *{tarefa}* está atrasada. 🚨

*Prazo: {prazo}* · {atraso} de atraso. ⏳

{checklist}

Abrir card em: {link}

Comu HUB 👋`,
  task_done: `Olá, {nome}! Sua tarefa *{tarefa}* foi concluída no Comu HUB. ✅

Abrir card em: {link}

{autor} · Comu HUB 👋`,
  cost_new: `Olá, {nome}! Nova solicitação de custo no Comu HUB, esperando sua aprovação. 💸

*{custo}*
*Valor: {valor}* (cobrança {frequencia})
Categoria: {categoria}
Data: {data}
Solicitado por: {autor}

{obs}

Aprovar ou reprovar em: {link}

Comu HUB 👋`,
  cost_decision: `Olá, {nome}! O custo *{custo}* ({valor}) foi {decisao}

Motivo: {justificativa}

Ver em: {link}

{autor} · Comu HUB 👋`,
  meeting: `Olá, {nome}! Reunião marcada: *{reuniao}*. 📅

*Quando: {quando}.*

Entrar: {link}

{autor} · Comu HUB 👋`,
  welcome: `Olá, {nome}! 👋
Você foi cadastrado(a) no *Comu HUB*, o painel do lançamento, por {autor}.
Por lá ficam o checklist, as suas tarefas, as reuniões e o histórico do time. Quando uma tarefa for sua ou uma reunião for marcada com você, eu te aviso por aqui.

Acesse: {link}`,
  ...CONTENT_TEMPLATES,
}

/**
 * Texto padrão de um aviso para o tipo de quadro. O conteúdo tem boas-vindas próprias; os
 * outros avisos são iguais em qualquer quadro. Mesma regra de `comu_hub_default_template`.
 */
export function defaultTemplate(kind: MessageKind, content: boolean): string {
  if (content && kind === 'welcome') return CONTENT_WELCOME
  return DEFAULT_MESSAGE_TEMPLATES[kind]
}

/** `{painel}` vira o nome do quadro antes do preenchimento (igual a `comu_hub_template`). */
export function withBoardName(template: string, boardName: string): string {
  return template.split('{painel}').join(boardName)
}

export const TEMPLATE_MAX_LENGTH = 2000

/**
 * Preenche os placeholders, linha a linha. Placeholder vazio some junto com o conector colado
 * nele (", por {autor}" · "{autor} · " · ", {nome}"). Se a linha tinha placeholder vazio e o que
 * sobrou depois do rótulo ("Prazo:", "Entrar:") não tem letra nem número, a linha inteira some.
 * Mesma regra da função SQL `comu_hub_fill_template`; mudar aqui exige mudar lá.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  const lines = template.split('\n').map((line) => {
    let out = line
    let hadEmpty = false
    for (const [key, raw] of Object.entries(values)) {
      const tag = `{${key}}`
      if (!out.includes(tag)) continue
      const value = raw.trim()
      if (value) {
        out = out.split(tag).join(value)
        continue
      }
      hadEmpty = true
      out = out
        .replace(new RegExp(`,?\\s*\\b(por|de|com)\\s+\\{${key}\\}`, 'g'), '')
        .replace(new RegExp(`\\{${key}\\}\\s*·\\s*`, 'g'), '')
        .replace(new RegExp(`\\s*·\\s*\\{${key}\\}`, 'g'), '')
        .replace(new RegExp(`,\\s*\\{${key}\\}`, 'g'), '')
        .split(tag)
        .join('')
    }
    if (hadEmpty) {
      const rest = out.replace(/[*_~]/g, '')
      const colon = rest.indexOf(':')
      const content = colon === -1 ? rest : rest.slice(colon + 1)
      if (!/[\p{L}\p{N}]/u.test(content)) return null
    }
    return out
  })
  return lines
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
