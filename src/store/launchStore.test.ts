import { beforeEach, describe, expect, it } from 'vitest'
import { CHECKLIST_TEMPLATE } from '../data/checklist'
import {
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  currentPhase,
  knownOwners,
  migrateLegacy,
  nextMilestone,
  overdueTasks,
  parseState,
  progressOf,
  STORAGE_KEY,
  UNREADABLE_KEY,
} from './launchStore'
import { renderHook } from '@testing-library/react'
import { useLaunchState } from './launchStore'

const TEMPLATE_TASKS = CHECKLIST_TEMPLATE.flatMap((p) => p.areas.flatMap((a) => a.tasks))

beforeEach(() => {
  __resetStoreForTests()
  localStorage.clear()
})

describe('estado inicial', () => {
  it('carrega todas as tarefas do modelo com datas padrão', () => {
    const s = buildInitialState('2026-09-18')
    expect(allTasks(s)).toHaveLength(TEMPLATE_TASKS.length)
    expect(s.kind).toBe('launch')
    expect(s.phases[0]).toMatchObject({ id: 'f1', start: '2026-09-18', end: '2026-09-24' })
    expect(s.phases[6]).toMatchObject({ id: 'f7', start: '2026-11-03', end: '2026-11-06' })
    expect(s.milestones.find((m) => m.id === 'm2')?.date).toBe('2026-10-16')
  })

  it('ids de tarefa são únicos', () => {
    const ids = allTasks(buildInitialState()).map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('seletores', () => {
  it('calcula progresso', () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 })
    const s = buildInitialState()
    const tasks = allTasks(s)
    tasks[0].done = true
    tasks[1].done = true
    expect(progressOf(tasks.slice(0, 4))).toEqual({ done: 2, total: 4, pct: 50 })
  })

  it('encontra fase atual, próxima fase antes do início e última após o fim', () => {
    const s = buildInitialState('2026-09-18')
    expect(currentPhase(s, '2026-10-05')?.id).toBe('f3')
    expect(currentPhase(s, '2026-01-01')?.id).toBe('f1')
    expect(currentPhase(s, '2027-01-01')?.id).toBe('f7')
  })

  it('próximo marco inclui o de hoje', () => {
    const s = buildInitialState('2026-09-18')
    expect(nextMilestone(s, '2026-10-02')?.id).toBe('m1')
    expect(nextMilestone(s, '2026-10-03')?.id).toBe('m2')
    expect(nextMilestone(s, '2027-01-01')).toBeUndefined()
  })

  it('lista atrasadas só se pendentes e com prazo passado', () => {
    const s = buildInitialState()
    const [a, b, c] = allTasks(s)
    a.due = '2026-09-01'
    b.due = '2026-09-01'
    b.done = true
    c.due = '2026-12-01'
    expect(overdueTasks(s, '2026-09-18').map((t) => t.id)).toEqual([a.id])
  })

  it('sugere responsáveis do brief e do checklist, sem duplicar', () => {
    const s = buildInitialState()
    s.brief.timeCopy = 'Ana'
    allTasks(s)[0].owner = 'Bruno'
    allTasks(s)[1].owner = 'Ana '
    const owners = knownOwners(s, ['timeCopy'])
    expect(owners).toEqual(expect.arrayContaining(['Ana', 'Bruno']))
    expect(new Set(owners).size).toBe(owners.length)
  })
})

describe('migração e importação', () => {
  it('migra formato v1 preservando status, datas e diário', () => {
    const legacy = {
      brief: { especialista: 'Gabi' },
      phases: [{ id: 'f1', name: 'Fase 1: Nova', start: '2026-01-05', end: '2026-01-10' }],
      milestones: [{ id: 'm1', label: 'Captação', date: '2026-01-20' }],
      tasks: { t1: { done: true, owner: 'Léo', due: '2026-01-06' } },
      diary: { 'f1-ESTRATÉGIA': 'ok' },
    }
    const s = migrateLegacy(legacy)
    expect(s.version).toBe(2)
    expect(s.brief.especialista).toBe('Gabi')
    expect(s.phases.find((p) => p.id === 'f1')).toMatchObject({
      name: 'Fase 1: Nova',
      start: '2026-01-05',
      end: '2026-01-10',
    })
    expect(allTasks(s).find((t) => t.id === 't1')).toMatchObject({
      done: true,
      owner: 'Léo',
      due: '2026-01-06',
    })
    expect(s.diary['f1:ESTRATÉGIA']).toBe('ok')
    expect(allTasks(s)).toHaveLength(TEMPLATE_TASKS.length)
  })

  it('parseState aceita v2, descarta lixo e rejeita formatos desconhecidos', () => {
    const s = buildInitialState()
    s.phases[1].areas[0].tasks.push({
      id: 'x',
      label: 'Custom',
      done: false,
      owner: '',
      due: 'nope',
      custom: true,
    })
    const round = parseState(JSON.parse(JSON.stringify(s)))
    const custom = allTasks(round).find((t) => t.id === 'x')
    expect(custom).toMatchObject({ label: 'Custom', due: '', custom: true })
    expect(() => parseState({ foo: 1 })).toThrow()
    expect(() => parseState(null)).toThrow()
    expect(() => parseState('str')).toThrow()
  })

  it('descarta valores não-string em brief e diário e ids de tarefa duplicados', () => {
    const s = buildInitialState()
    const raw = JSON.parse(JSON.stringify(s))
    raw.brief = { especialista: 'Gabi', metaFaturamento: 1000, objetivo: { x: 1 } }
    raw.diary = { 'f1:ESTRATÉGIA': 'ok', 'f2:CONTEÚDO': null }
    raw.phases[1].areas[0].tasks.push({ id: 't1', label: 'Duplicada', done: true })
    const out = parseState(raw)
    expect(out.brief).toEqual({ especialista: 'Gabi' })
    expect(out.diary).toEqual({ 'f1:ESTRATÉGIA': 'ok' })
    expect(allTasks(out).filter((t) => t.id === 't1')).toHaveLength(1)
    expect(allTasks(out).find((t) => t.id === 't1')?.label).toBe('Kick-off')
  })

  it('preserva um blob ilegível em outra chave em vez de sobrescrevê-lo', () => {
    localStorage.setItem(STORAGE_KEY, '{"version":99,"future":true')
    const { result } = renderHook(() => useLaunchState())
    expect(allTasks(result.current)).toHaveLength(TEMPLATE_TASKS.length)
    expect(localStorage.getItem(UNREADABLE_KEY)).toBe('{"version":99,"future":true')
  })

  it('reinsere fase do modelo que falta no estado salvo, na posição certa', () => {
    const s = buildInitialState('2026-09-18')
    const raw = JSON.parse(JSON.stringify({ ...s, phases: s.phases.filter((p) => p.id !== 'f3') }))
    raw.phases[0].name = 'Minha fase 1'
    const out = parseState(raw)
    expect(out.phases.map((p) => p.id)).toEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'])
    expect(out.phases[2]).toMatchObject({ id: 'f3', start: '2026-10-02', end: '2026-10-15' })
    expect(out.phases[0].name).toBe('Minha fase 1')
  })

  it('quadro com fases próprias não recebe mais o modelo de volta', () => {
    const s = buildInitialState('2026-09-18')
    const raw = JSON.parse(
      JSON.stringify({ ...s, phasesCustom: true, phases: s.phases.filter((p) => p.id !== 'f3') }),
    )
    expect(parseState(raw).phases.map((p) => p.id)).toEqual(['f1', 'f2', 'f4', 'f5', 'f6', 'f7'])
    // quadro que não é de lançamento também fica com as fases dele
    const sprint = JSON.parse(JSON.stringify({ ...s, kind: 'sprint', phases: [s.phases[0]] }))
    const out = parseState(sprint)
    expect(out.kind).toBe('sprint')
    expect(out.phases.map((p) => p.id)).toEqual(['f1'])
  })

  it('parseState roteia v1 para migração', () => {
    const s = parseState({ tasks: { t2: { done: true } } })
    expect(allTasks(s).find((t) => t.id === 't2')?.done).toBe(true)
  })
})

describe('campos do quadro', () => {
  it('parse preserva nome, modelo, fases próprias e a URL gravada pelo servidor', () => {
    const s = buildInitialState('2026-09-18', 'sprint')
    const raw = JSON.parse(
      JSON.stringify({
        ...s,
        name: '  Estúdio Aurora  ',
        url: 'https://seu-hub.vercel.app/aurora',
        phasesCustom: true,
      }),
    )
    const out = parseState(raw)
    expect(out.name).toBe('Estúdio Aurora')
    expect(out.kind).toBe('sprint')
    expect(out.url).toBe('https://seu-hub.vercel.app/aurora')
    expect(out.phasesCustom).toBe(true)
    // estado antigo (sem nenhum deles) é lançamento sem URL própria
    const antigo = JSON.parse(JSON.stringify(buildInitialState('2026-09-18'))) as Record<
      string,
      unknown
    >
    delete antigo.kind
    const velho = parseState(antigo)
    expect(velho.kind).toBe('launch')
    expect(velho.url).toBeUndefined()
    expect(velho.name).toBeUndefined()
  })
})
