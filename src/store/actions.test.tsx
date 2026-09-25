import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __flushForTests,
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  PREVIOUS_KEY,
  STORAGE_KEY,
  useLaunchActions,
  useLaunchState,
} from './launchStore'

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})

function setup() {
  return renderHook(() => ({ state: useLaunchState(), actions: useLaunchActions() }))
}

describe('ações editáveis', () => {
  it('adiciona, edita, reordena e remove tarefa; persiste no localStorage', () => {
    const { result } = setup()
    const areaId = result.current.state.phases[0].areas[0].id
    let id = ''
    act(() => {
      id = result.current.actions.addTask(areaId, '  Nova tarefa  ')
    })
    let area = result.current.state.phases[0].areas[0]
    expect(area.tasks.at(-1)).toMatchObject({ id, label: 'Nova tarefa', custom: true, done: false })

    act(() =>
      result.current.actions.patchTask(id, {
        label: 'Editada',
        owner: 'Ana',
        due: '2026-10-01',
        done: true,
      }),
    )
    expect(allTasks(result.current.state).find((t) => t.id === id)).toMatchObject({
      label: 'Editada',
      owner: 'Ana',
      done: true,
    })

    act(() => result.current.actions.moveTask(id, -1))
    area = result.current.state.phases[0].areas[0]
    expect(area.tasks.at(-2)?.id).toBe(id)

    act(() => result.current.actions.removeTask(id))
    expect(allTasks(result.current.state).some((t) => t.id === id)).toBe(false)

    __flushForTests()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.version).toBe(2)
    expect(allTasks(saved).some((t: { id: string }) => t.id === id)).toBe(false)
  })

  it('ignora tarefa vazia', () => {
    const { result } = setup()
    const before = allTasks(result.current.state).length
    act(() => {
      result.current.actions.addTask(result.current.state.phases[0].areas[0].id, '   ')
    })
    expect(allTasks(result.current.state)).toHaveLength(before)
  })

  it('cria, renomeia e remove área (com tarefas) e conclui todas', () => {
    const { result } = setup()
    let areaId = ''
    act(() => {
      areaId = result.current.actions.addArea('f2', 'jurídico')
    })
    const phase = () => result.current.state.phases.find((p) => p.id === 'f2')!
    expect(phase().areas.at(-1)).toMatchObject({ id: areaId, name: 'JURÍDICO', tasks: [] })

    act(() => {
      result.current.actions.addTask(areaId, 'Contrato')
      result.current.actions.addTask(areaId, 'Termos')
      result.current.actions.setAreaDone(areaId, true)
      result.current.actions.renameArea(areaId, 'legal')
    })
    const a = phase().areas.find((x) => x.id === areaId)!
    expect(a.name).toBe('LEGAL')
    expect(a.tasks.every((t) => t.done)).toBe(true)

    act(() => result.current.actions.removeArea(areaId))
    expect(phase().areas.some((x) => x.id === areaId)).toBe(false)
  })

  it('desloca início do lançamento movendo fases, marcos e prazos', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    act(() => result.current.actions.patchTask(t0, { due: '2026-09-20' }))
    act(() => result.current.actions.shiftLaunchStart('2026-10-01'))
    const s = result.current.state
    expect(s.launchStart).toBe('2026-10-01')
    expect(s.phases[0]).toMatchObject({ start: '2026-10-01', end: '2026-10-07' })
    expect(s.milestones[0].date).toBe('2026-10-15')
    expect(allTasks(s)[0].due).toBe('2026-10-03')
  })

  it('restaura datas padrão sem tocar em nomes e tarefas', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    act(() => {
      result.current.actions.patchPhase('f1', { name: 'Renomeada', end: '2027-01-01' })
      result.current.actions.patchTask(t0, { done: true })
      result.current.actions.removeMilestone('m8')
    })
    act(() => result.current.actions.restoreDefaultDates())
    const s = result.current.state
    expect(s.phases[0]).toMatchObject({ name: 'Renomeada', end: '2026-09-24' })
    expect(s.milestones).toHaveLength(8)
    expect(allTasks(s)[0].done).toBe(true)
  })

  it('brief e diário salvam por chave', () => {
    const { result } = setup()
    act(() => {
      result.current.actions.setBrief('especialista', 'Gabi')
      result.current.actions.setDiary('f1:ESTRATÉGIA', 'kick-off feito')
    })
    expect(result.current.state.brief.especialista).toBe('Gabi')
    expect(result.current.state.diary['f1:ESTRATÉGIA']).toBe('kick-off feito')
  })

  it('resetAll volta ao modelo e guarda snapshot do estado anterior', () => {
    const { result } = setup()
    act(() => result.current.actions.setBrief('especialista', 'X'))
    act(() => result.current.actions.resetAll())
    expect(result.current.state.brief).toEqual({})
    expect(JSON.parse(localStorage.getItem(PREVIOUS_KEY)!).brief.especialista).toBe('X')
  })

  it('gravação é debounced: várias edições viram uma escrita, e flush grava o último estado', () => {
    const { result } = setup()
    act(() => {
      result.current.actions.setBrief('especialista', 'A')
      result.current.actions.setBrief('especialista', 'AB')
      result.current.actions.setBrief('especialista', 'ABC')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    __flushForTests()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).brief.especialista).toBe('ABC')
  })

  it('ignora datas inválidas (input de data limpo) em fase, marco e prazo', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    act(() => {
      result.current.actions.patchPhase('f1', { start: '2026-13-99' })
      result.current.actions.patchMilestone('m1', { date: 'abc' })
      result.current.actions.patchTask(t0, { due: '2026-13-99' })
    })
    expect(result.current.state.phases[0].start).toBe('2026-09-18')
    expect(result.current.state.milestones[0].date).toBe('2026-10-02')
    expect(allTasks(result.current.state)[0].due).toBe('')
    act(() => result.current.actions.patchTask(t0, { due: '' }))
    expect(allTasks(result.current.state)[0].due).toBe('')
  })
})

describe('mover tarefa entre fases', () => {
  it('leva a tarefa para o fim da área de destino e registra origem e destino', () => {
    const { result } = setup()
    const s0 = result.current.state
    const t0 = s0.phases[0].areas[0].tasks[0].id // Kick-off, Fase 1 › ESTRATÉGIA
    const target = s0.phases[1].areas[0].id // Fase 2 › CONTEÚDO
    act(() => result.current.actions.moveTaskToArea(t0, target))
    const s = result.current.state
    expect(s.phases[0].areas[0].tasks.some((t) => t.id === t0)).toBe(false)
    expect(s.phases[1].areas[0].tasks.at(-1)?.id).toBe(t0)
    expect(allTasks(s)).toHaveLength(allTasks(s0).length)
    // mover para a própria área não faz nada
    const before = result.current.state
    act(() => result.current.actions.moveTaskToArea(t0, target))
    expect(result.current.state).toBe(before)
  })
})

describe('placeTask (arrastar e soltar)', () => {
  it('reordena dentro da área: antes de outra tarefa ou no fim', () => {
    const { result } = setup()
    const area = () => result.current.state.phases[0].areas[0]
    const ids = area().tasks.map((t) => t.id)
    act(() => result.current.actions.placeTask(ids[0], area().id, ids[2]))
    expect(
      area()
        .tasks.map((t) => t.id)
        .slice(0, 3),
    ).toEqual([ids[1], ids[0], ids[2]])
    act(() => result.current.actions.placeTask(ids[0], area().id, null))
    expect(area().tasks.at(-1)?.id).toBe(ids[0])
    // soltar no mesmo lugar não gera estado novo
    const before = result.current.state
    act(() => result.current.actions.placeTask(ids[0], area().id, null))
    expect(result.current.state).toBe(before)
  })
  it('move para outra área e registra no histórico', () => {
    const { result } = setup()
    const from = result.current.state.phases[0].areas[0]
    const target = result.current.state.phases[1].areas[0]
    const id = from.tasks[0].id
    const anchor = target.tasks[0].id
    act(() => result.current.actions.placeTask(id, target.id, anchor))
    const t2 = result.current.state.phases[1].areas[0]
    expect(t2.tasks[0].id).toBe(id)
    expect(t2.tasks[1].id).toBe(anchor)
    expect(result.current.state.phases[0].areas[0].tasks.some((t) => t.id === id)).toBe(false)
  })
})

describe('fases do quadro', () => {
  it('cria, move e apaga fase, e a partir daí o modelo não volta mais', () => {
    const { result } = setup()
    const before = result.current.state.phases.length
    let id = ''
    act(() => {
      expect(result.current.actions.addPhase('   ')).toBe('')
      id = result.current.actions.addPhase(' Semana 1 ', { start: '2026-10-01', end: 'x' })
    })
    expect(result.current.state.phasesCustom).toBe(true)
    expect(result.current.state.phases).toHaveLength(before + 1)
    expect(result.current.state.phases.at(-1)).toMatchObject({
      id,
      name: 'Semana 1',
      start: '2026-10-01',
      end: '',
      areas: [],
    })

    act(() => result.current.actions.movePhase(id, 'up'))
    expect(result.current.state.phases.at(-2)?.id).toBe(id)
    act(() => result.current.actions.movePhase(id, 'down'))
    expect(result.current.state.phases.at(-1)?.id).toBe(id)
    // na ponta não sai do lugar
    const first = result.current.state.phases[0].id
    act(() => result.current.actions.movePhase(first, 'up'))
    expect(result.current.state.phases[0].id).toBe(first)

    act(() => result.current.actions.setDiary(`${id}:GERAL`, 'anotação'))
    act(() => result.current.actions.removePhase(id))
    expect(result.current.state.phases).toHaveLength(before)
    expect(result.current.state.diary[`${id}:GERAL`]).toBeUndefined()
  })

  it('não deixa o quadro sem nenhuma fase', () => {
    const { result } = setup()
    act(() => {
      for (const p of [...result.current.state.phases]) result.current.actions.removePhase(p.id)
    })
    expect(result.current.state.phases).toHaveLength(1)
  })

  it('data vazia é fase sem cronograma', () => {
    const { result } = setup()
    act(() => result.current.actions.patchPhase('f1', { start: '', end: '' }))
    expect(result.current.state.phases[0]).toMatchObject({ start: '', end: '' })
  })
})

describe('modelos de quadro', () => {
  it('sprint e em branco nascem sem datas e sem marcos', () => {
    const sprint = buildInitialState('2026-09-18', 'sprint')
    expect(sprint.kind).toBe('sprint')
    expect(sprint.phases.map((p) => p.name)).toEqual([
      'Backlog',
      'Sprint atual',
      'Próxima sprint',
      'Concluído',
    ])
    expect(sprint.phases.every((p) => p.start === '' && p.end === '')).toBe(true)
    expect(sprint.milestones).toEqual([])
    expect(allTasks(sprint)).toEqual([])

    const blank = buildInitialState('2026-09-18', 'blank')
    expect(blank.phases).toHaveLength(1)
    expect(blank.phases[0].areas.map((a) => a.name)).toEqual(['GERAL'])
  })
})
