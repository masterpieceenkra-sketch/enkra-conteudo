/** Um evento do histórico: quem fez o quê, em qual entidade. */
export interface ActivityInput {
  action: ActivityAction
  entityType?:
    | 'task'
    | 'area'
    | 'phase'
    | 'milestone'
    | 'meeting'
    | 'notify'
    | 'brief'
    | 'diary'
    | 'label'
    | 'launch'
    | 'person'
    | 'card'
    | 'column'
    | 'campaign'
    | 'strategy'
  entityId?: string
  entityLabel?: string
  details?: Record<string, unknown>
}

export interface ActivityRecord extends ActivityInput {
  id: number | string
  at: string
  actor: string
  actorEmail?: string
}

export type ActivityAction =
  | 'task.add'
  | 'task.remove'
  | 'task.move'
  | 'task.done'
  | 'task.undone'
  | 'task.rename'
  | 'task.owner'
  | 'task.due'
  | 'task.link'
  | 'task.description'
  | 'task.label_on'
  | 'task.label_off'
  | 'checklist.add'
  | 'checklist.rename'
  | 'checklist.remove'
  | 'checklist.item_add'
  | 'checklist.item_done'
  | 'checklist.item_undone'
  | 'checklist.item_rename'
  | 'checklist.item_remove'
  | 'area.add'
  | 'area.rename'
  | 'area.remove'
  | 'area.done_all'
  | 'area.undone_all'
  | 'phase.update'
  | 'phase.add'
  | 'phase.remove'
  | 'phase.move'
  | 'milestone.add'
  | 'milestone.update'
  | 'milestone.remove'
  | 'meeting.add'
  | 'meeting.update'
  | 'meeting.remove'
  | 'label.add'
  | 'label.update'
  | 'label.remove'
  | 'brief.set'
  | 'diary.set'
  | 'calendar.shift'
  | 'calendar.restore'
  | 'person.add'
  | 'person.update'
  | 'person.remove'
  | 'notify.on'
  | 'notify.off'
  | 'notify.every'
  | 'notify.time'
  | 'notify.custom'
  | 'notify.task_update'
  | 'notify.template'
  | 'card.add'
  | 'card.remove'
  | 'card.move'
  | 'card.update'
  | 'card.owner'
  | 'card.date'
  | 'card.comment'
  | 'card.attach'
  | 'card.review'
  | 'column.add'
  | 'column.update'
  | 'column.remove'
  | 'campaign.add'
  | 'campaign.update'
  | 'campaign.remove'
  | 'strategy.update'
  | 'data.import'
  | 'data.reset'
  | 'launch.create'

/** Texto humano de cada ação, no passado, para o histórico. */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  'task.add': 'criou a tarefa',
  'task.remove': 'excluiu a tarefa',
  'task.move': 'moveu a tarefa',
  'task.done': 'concluiu',
  'task.undone': 'reabriu',
  'task.rename': 'renomeou a tarefa',
  'task.owner': 'definiu o responsável de',
  'task.due': 'definiu o prazo de',
  'task.link': 'alterou o link de',
  'task.description': 'editou a descrição de',
  'task.label_on': 'aplicou etiqueta em',
  'task.label_off': 'removeu etiqueta de',
  'checklist.add': 'criou uma checklist em',
  'checklist.rename': 'renomeou uma checklist em',
  'checklist.remove': 'excluiu uma checklist de',
  'checklist.item_add': 'adicionou item na checklist de',
  'checklist.item_done': 'marcou item da checklist de',
  'checklist.item_undone': 'desmarcou item da checklist de',
  'checklist.item_rename': 'editou item da checklist de',
  'checklist.item_remove': 'removeu item da checklist de',
  'area.add': 'criou a área',
  'area.rename': 'renomeou a área',
  'area.remove': 'excluiu a área',
  'area.done_all': 'concluiu todas as tarefas de',
  'area.undone_all': 'desmarcou todas as tarefas de',
  'phase.add': 'criou a fase',
  'phase.remove': 'apagou a fase',
  'phase.move': 'mudou a fase de lugar',
  'phase.update': 'alterou a fase',
  'milestone.add': 'criou o marco',
  'milestone.update': 'alterou o marco',
  'milestone.remove': 'excluiu o marco',
  'meeting.add': 'marcou a reunião',
  'meeting.update': 'alterou a reunião',
  'meeting.remove': 'excluiu a reunião',
  'label.add': 'criou a etiqueta',
  'label.update': 'alterou a etiqueta',
  'label.remove': 'excluiu a etiqueta',
  'brief.set': 'preencheu no brief',
  'diary.set': 'escreveu no diário',
  'calendar.shift': 'moveu o calendário',
  'calendar.restore': 'restaurou as datas padrão',
  'person.add': 'cadastrou a pessoa',
  'person.update': 'alterou o cadastro de',
  'person.remove': 'removeu a pessoa',
  'notify.on': 'ligou o aviso',
  'notify.off': 'desligou o aviso',
  'notify.every': 'mudou a frequência do aviso',
  'notify.time': 'mudou o horário do aviso',
  'notify.custom': 'enviou mensagem no WhatsApp para',
  'notify.task_update': 'reenviou no WhatsApp o aviso da tarefa',
  'notify.template': 'alterou o texto do aviso',
  'card.add': 'criou o card',
  'card.remove': 'excluiu o card',
  'card.move': 'moveu o card',
  'card.update': 'editou o card',
  'card.owner': 'definiu o responsável de',
  'card.date': 'mudou a data de',
  'card.comment': 'comentou em',
  'card.attach': 'anexou arquivo em',
  'card.review': 'deu retorno em',
  'column.add': 'criou a coluna',
  'column.update': 'alterou a coluna',
  'column.remove': 'excluiu a coluna',
  'campaign.add': 'criou a campanha',
  'campaign.update': 'alterou a campanha',
  'campaign.remove': 'excluiu a campanha',
  'strategy.update': 'editou a estratégia',
  'data.import': 'importou um backup',
  'data.reset': 'zerou todos os dados',
  'launch.create': 'criou o lançamento no banco',
}

/** Eventos de digitação contínua colapsam num só enquanto estão na fila. */
export function activityKey(e: ActivityInput): string {
  return `${e.action}:${e.entityId ?? ''}`
}

/** Complemento curto do evento para exibição (de/para, item, etiqueta). */
export function detailText(r: ActivityRecord): string | null {
  const d = r.details ?? {}
  switch (r.action) {
    case 'task.rename':
    case 'area.rename':
      return d.from ? `de "${d.from}"` : null
    case 'task.move':
      return d.from && d.to ? `de ${d.from} para ${d.to}` : null
    case 'task.owner':
      return d.to ? `→ ${d.to}` : '(removido)'
    case 'task.due':
      return d.to ? `→ ${String(d.to).split('-').reverse().join('/')}` : '(removido)'
    case 'task.label_on':
    case 'task.label_off':
      return d.label ? `"${d.label}"` : null
    case 'checklist.add':
    case 'checklist.rename':
    case 'checklist.remove':
      return d.title ? `"${d.title}"` : null
    case 'checklist.item_add':
    case 'checklist.item_done':
    case 'checklist.item_undone':
    case 'checklist.item_rename':
    case 'checklist.item_remove':
      return d.item ? `"${d.item}"` : null
    case 'brief.set':
    case 'diary.set':
    case 'task.description':
      return typeof d.value === 'string' && d.value ? `"${d.value}"` : null
    case 'calendar.shift':
      return typeof d.delta === 'number' ? `${d.delta > 0 ? '+' : ''}${d.delta} dias` : null
    case 'notify.every':
      return typeof d.days === 'number'
        ? d.days === 1
          ? 'todo dia'
          : `a cada ${d.days} dias`
        : null
    case 'notify.time':
      return typeof d.hour === 'number' ? `às ${String(d.hour).padStart(2, '0')}:00` : null
    case 'notify.custom':
      return typeof d.message === 'string' && d.message ? `"${d.message}"` : null
    case 'notify.task_update':
      return typeof d.to === 'string' && d.to ? `para ${d.to}` : null
    case 'notify.template':
      return d.restored ? '(voltou ao padrão)' : null
    case 'meeting.add':
    case 'meeting.update':
      return d.date
        ? `${String(d.date).split('-').reverse().join('/')}${d.time ? ` ${d.time}` : ''}`
        : null
    default:
      return null
  }
}
