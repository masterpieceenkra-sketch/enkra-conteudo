// Modelos de quadro: o que nasce dentro dele quando é criado.
// Lançamento usa o checklist completo com datas; os outros nascem enxutos e sem cronograma.
import { CHECKLIST_TEMPLATE } from './checklist'
import { defaultMilestones, defaultPhaseDates } from './phases'
import type { BoardKind, Milestone, Phase, PhaseTemplate } from './types'
import type { IsoDate } from '../lib/dates'

/** Fases sem cronograma: nome e áreas, datas vazias. */
const SPRINT_TEMPLATE: PhaseTemplate[] = [
  { id: 's1', name: 'Backlog', areas: [{ name: 'GERAL', tasks: [] }] },
  { id: 's2', name: 'Sprint atual', areas: [{ name: 'GERAL', tasks: [] }] },
  { id: 's3', name: 'Próxima sprint', areas: [{ name: 'GERAL', tasks: [] }] },
  { id: 's4', name: 'Concluído', areas: [{ name: 'GERAL', tasks: [] }] },
]

const BLANK_TEMPLATE: PhaseTemplate[] = [
  { id: 'p1', name: 'Tarefas', areas: [{ name: 'GERAL', tasks: [] }] },
]

function templateOf(kind: BoardKind): PhaseTemplate[] {
  if (kind === 'sprint') return SPRINT_TEMPLATE
  if (kind === 'blank') return BLANK_TEMPLATE
  return CHECKLIST_TEMPLATE
}

/** Ids das fases do modelo, na ordem — usado para reinserir fase faltante em quadro de lançamento. */
export function templatePhaseIds(kind: BoardKind): string[] {
  return templateOf(kind).map((p) => p.id)
}

/** Fases iniciais do quadro. Só o modelo de lançamento nasce com datas. */
export function templatePhases(kind: BoardKind, startDate: IsoDate): Phase[] {
  const dates = kind === 'launch' ? defaultPhaseDates(startDate) : {}
  return templateOf(kind).map((p) => ({
    id: p.id,
    name: p.name,
    start: dates[p.id]?.start ?? '',
    end: dates[p.id]?.end ?? '',
    areas: p.areas.map((a) => ({
      id: `${p.id}:${a.name}`,
      name: a.name,
      tasks: a.tasks.map((t) => ({
        id: t.id,
        label: t.label,
        done: false,
        owner: t.owner ?? '',
        due: '',
      })),
    })),
  }))
}

/** Marcos iniciais: CPL, carrinho e downsell só fazem sentido em lançamento. */
export function templateMilestones(kind: BoardKind, startDate: IsoDate): Milestone[] {
  return kind === 'launch' ? defaultMilestones(startDate) : []
}
