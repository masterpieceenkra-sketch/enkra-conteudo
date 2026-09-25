import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LABELS } from '../data/labels'
import {
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  checklistProgress,
  findTask,
  parseState,
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

describe('cards: etiquetas, link, descrição e checklists', () => {
  it('estado inicial traz as etiquetas padrão', () => {
    expect(buildInitialState().labels).toEqual(DEFAULT_LABELS)
  })

  it('aplica e remove etiqueta; cria etiqueta nova; excluir etiqueta limpa as tarefas', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    act(() => result.current.actions.toggleTaskLabel(t0, 'l-urgente'))
    expect(findTask(result.current.state, t0)?.labelIds).toEqual(['l-urgente'])
    act(() => result.current.actions.toggleTaskLabel(t0, 'l-urgente'))
    expect(findTask(result.current.state, t0)?.labelIds).toEqual([])

    let id = ''
    act(() => {
      id = result.current.actions.addLabel('  Jurídico ', 'blue')
      result.current.actions.toggleTaskLabel(t0, id)
    })
    expect(result.current.state.labels.at(-1)).toEqual({ id, name: 'Jurídico', color: 'blue' })
    act(() => result.current.actions.patchLabel(id, { name: 'Legal', color: 'aqua' }))
    expect(result.current.state.labels.at(-1)).toMatchObject({ name: 'Legal', color: 'aqua' })
    act(() => result.current.actions.patchLabel(id, { name: '   ' }))
    expect(result.current.state.labels.at(-1)?.name).toBe('Legal')

    act(() => result.current.actions.removeLabel(id))
    expect(result.current.state.labels.some((l) => l.id === id)).toBe(false)
    expect(findTask(result.current.state, t0)?.labelIds).toEqual([])
    expect(result.current.actions.addLabel('', 'pink')).toBe('')
  })

  it('link só aceita http(s); descrição livre', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    act(() => result.current.actions.patchTask(t0, { link: 'javascript:alert(1)' }))
    expect(findTask(result.current.state, t0)?.link).toBeUndefined()
    act(() => result.current.actions.patchTask(t0, { link: 'https://drive.google.com/x' }))
    expect(findTask(result.current.state, t0)?.link).toBe('https://drive.google.com/x')
    act(() => result.current.actions.patchTask(t0, { link: '' }))
    expect(findTask(result.current.state, t0)?.link).toBe('')
    act(() => result.current.actions.patchTask(t0, { description: 'Contexto' }))
    expect(findTask(result.current.state, t0)?.description).toBe('Contexto')
  })

  it('checklists: cria, renomeia, adiciona/marca/renomeia/remove itens e exclui', () => {
    const { result } = setup()
    const t0 = allTasks(result.current.state)[0].id
    let cid = ''
    let i1 = ''
    act(() => {
      cid = result.current.actions.addChecklist(t0, '  ')
    })
    expect(findTask(result.current.state, t0)?.checklists?.[0]).toMatchObject({
      id: cid,
      title: 'Checklist',
      items: [],
    })
    act(() => {
      result.current.actions.patchChecklist(t0, cid, { title: 'Entregáveis' })
      i1 = result.current.actions.addChecklistItem(t0, cid, 'Nome do produto')
      result.current.actions.addChecklistItem(t0, cid, 'Preço')
      expect(result.current.actions.addChecklistItem(t0, cid, '   ')).toBe('')
    })
    act(() =>
      result.current.actions.patchChecklistItem(t0, cid, i1, { done: true, text: 'Nome final' }),
    )
    const task = findTask(result.current.state, t0)!
    expect(task.checklists?.[0].title).toBe('Entregáveis')
    expect(task.checklists?.[0].items).toHaveLength(2)
    expect(task.checklists?.[0].items[0]).toMatchObject({ done: true, text: 'Nome final' })
    expect(checklistProgress(task)).toEqual({ done: 1, total: 2 })

    act(() => result.current.actions.removeChecklistItem(t0, cid, i1))
    expect(checklistProgress(findTask(result.current.state, t0)!)).toEqual({ done: 0, total: 1 })
    act(() => result.current.actions.removeChecklist(t0, cid))
    expect(findTask(result.current.state, t0)?.checklists).toBeUndefined()
  })

  it('import valida extras do card e etiquetas; estado antigo sem labels recebe as padrão', () => {
    const s = buildInitialState()
    const raw = JSON.parse(JSON.stringify(s))
    delete raw.labels
    const t = raw.phases[0].areas[0].tasks[0]
    t.labelIds = ['l-urgente', 'l-inexistente', 42, 'l-urgente']
    t.link = 'ftp://nope'
    t.description = '   '
    t.checklists = [
      {
        id: 'c1',
        title: 7,
        items: [{ id: 'i1', text: 'ok', done: 'yes' }, { text: 'sem id' }, null],
      },
      { title: 'sem id' },
    ]
    raw.phases[0].areas[0].tasks[1].link = 'https://ok.com'
    const out = parseState(raw)
    expect(out.labels).toEqual(DEFAULT_LABELS)
    const t0 = allTasks(out)[0]
    expect(t0.labelIds).toEqual(['l-urgente'])
    expect(t0.link).toBeUndefined()
    expect(t0.description).toBeUndefined()
    expect(t0.checklists).toEqual([
      { id: 'c1', title: 'Checklist', items: [{ id: 'i1', text: 'ok', done: true }] },
    ])
    expect(allTasks(out)[1].link).toBe('https://ok.com')

    const rawLabels = JSON.parse(JSON.stringify(s))
    rawLabels.labels = [
      { id: 'a', name: 'A', color: 'roxo' },
      { id: 'a', name: 'dup' },
      { name: 'sem id' },
    ]
    expect(parseState(rawLabels).labels).toEqual([{ id: 'a', name: 'A', color: 'gray' }])
  })
})
