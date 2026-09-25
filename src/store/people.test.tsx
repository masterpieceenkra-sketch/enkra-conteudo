import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFS } from '../data/types'
import {
  __resetStoreForTests,
  allTasks,
  buildInitialState,
  findTask,
  normalizeOverdueEvery,
  normalizePhone,
  personByPhone,
  personPhones,
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

describe('pessoas do time', () => {
  it('normaliza telefone brasileiro para dígitos com DDI', () => {
    expect(normalizePhone('(85) 99999-0000')).toBe('5585999990000')
    expect(normalizePhone('+55 11 98888-7777')).toBe('5511988887777')
    expect(normalizePhone('')).toBe('')
  })

  it('cadastra, vira responsável por id, renomeia em cascata e remove limpando referências', () => {
    const { result } = setup()
    let id = ''
    act(() => {
      expect(
        result.current.actions.addPerson({ name: '  ', email: '', phone: '', notify: true }),
      ).toBe('')
      id = result.current.actions.addPerson({
        name: ' Igor ',
        email: ' IGOR@Enkra.com ',
        phone: '(85) 99999-0000',
        notify: true,
      })
    })
    expect(result.current.state.people).toEqual([
      { id, name: 'Igor', email: 'igor@enkra.com', phone: '5585999990000', notify: true },
    ])

    const t0 = allTasks(result.current.state)[0].id
    act(() => result.current.actions.patchTask(t0, { owner: 'Igor', ownerId: id }))
    expect(findTask(result.current.state, t0)).toMatchObject({ owner: 'Igor', ownerId: id })

    act(() => result.current.actions.patchPerson(id, { name: 'Igor Alves', notify: false }))
    expect(findTask(result.current.state, t0)?.owner).toBe('Igor Alves')
    expect(result.current.state.people[0]).toMatchObject({ name: 'Igor Alves', notify: false })

    let mid = ''
    act(() => {
      mid = result.current.actions.addMeeting({
        title: 'Call',
        date: '2026-10-02',
        time: '10:00',
        durationMin: 60,
        link: '',
        agenda: '',
        attendeeIds: [id, id],
      })
    })
    expect(result.current.state.meetings.find((m) => m.id === mid)?.attendeeIds).toEqual([id])

    act(() => result.current.actions.removePerson(id))
    expect(result.current.state.people).toEqual([])
    expect(findTask(result.current.state, t0)).toMatchObject({ owner: 'Igor Alves' })
    expect(findTask(result.current.state, t0)?.ownerId).toBeUndefined()
    expect(result.current.state.meetings.find((m) => m.id === mid)?.attendeeIds).toEqual([])
  })

  it('import valida pessoas, ownerId e attendeeIds', () => {
    const s = buildInitialState()
    const raw = JSON.parse(JSON.stringify(s))
    raw.people = [
      { id: 'p1', name: 'Ana', phone: '(11) 98888-7777' },
      { id: 'p1', name: 'dup' },
      { name: 'sem id' },
    ]
    raw.phases[0].areas[0].tasks[0].ownerId = 'p1'
    raw.meetings = [{ id: 'm', title: 'X', date: '2026-10-02', attendeeIds: ['p1', 7] }]
    const out = parseState(raw)
    expect(out.people).toEqual([
      { id: 'p1', name: 'Ana', email: '', phone: '5511988887777', notify: true },
    ])
    expect(allTasks(out).find((t) => t.id === 't1')?.ownerId).toBe('p1')
    expect(out.meetings[0].attendeeIds).toEqual(['p1'])
    delete raw.people
    expect(parseState(raw).people).toEqual([])
  })
})

describe('preferências de aviso', () => {
  it('nascem ligadas, sobrevivem ao parse e podem ser desligadas', () => {
    expect(buildInitialState().notifications).toEqual(DEFAULT_NOTIFICATION_PREFS)
    const raw = JSON.parse(JSON.stringify(buildInitialState())) as Record<string, unknown>
    delete raw.notifications
    expect(parseState(raw).notifications).toEqual(DEFAULT_NOTIFICATION_PREFS)
    raw.notifications = { taskAssigned: false, dueTomorrow: 'sim', dueToday: false }
    expect(parseState(raw).notifications).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      taskAssigned: false,
      dueToday: false,
    })

    const { result } = setup()
    act(() => result.current.actions.setNotificationPref('dueTomorrow', false))
    expect(result.current.state.notifications).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      dueTomorrow: false,
    })
    act(() => result.current.actions.setNotificationPref('taskAssignedRequireDue', true))
    expect(result.current.state.notifications.taskAssignedRequireDue).toBe(true)
    act(() => result.current.actions.setNotificationPref('taskDone', false))
    expect(result.current.state.notifications.taskDone).toBe(false)
  })

  it('frequência da cobrança de atraso só aceita os intervalos da tela', () => {
    expect(normalizeOverdueEvery(2)).toBe(2)
    expect(normalizeOverdueEvery(7)).toBe(7)
    expect(normalizeOverdueEvery(5)).toBe(1)
    expect(normalizeOverdueEvery('2')).toBe(1)
    expect(normalizeOverdueEvery(undefined)).toBe(1)

    const { result } = setup()
    act(() => result.current.actions.setOverdueEvery(3))
    expect(result.current.state.notifications.overdueEveryDays).toBe(3)
    act(() => result.current.actions.setOverdueEvery(99))
    expect(result.current.state.notifications.overdueEveryDays).toBe(1)
    const raw = JSON.parse(JSON.stringify(result.current.state))
    raw.notifications.overdueEveryDays = 7
    expect(parseState(raw).notifications.overdueEveryDays).toBe(7)
  })
})

describe('cargo da pessoa', () => {
  it('guarda o cargo no cadastro, no parse e na entrada pelo link', () => {
    const { result } = setup()
    let id = ''
    act(() => {
      id = result.current.actions.addPerson({
        name: 'Ana',
        email: 'ana@x.com',
        phone: '',
        role: '  Copywriter ',
        notify: true,
      })
    })
    expect(result.current.state.people[0].role).toBe('Copywriter')
    act(() => result.current.actions.patchPerson(id, { role: 'Gestora de tráfego' }))
    expect(result.current.state.people[0].role).toBe('Gestora de tráfego')
    const raw = JSON.parse(JSON.stringify(result.current.state))
    expect(parseState(raw).people[0].role).toBe('Gestora de tráfego')
  })
})

describe('vários responsáveis', () => {
  it('setTaskOwners guarda a lista, o texto com os nomes e o principal; remover pessoa tira só ela', () => {
    const { result } = setup()
    let a = ''
    let b = ''
    act(() => {
      a = result.current.actions.addPerson({ name: 'Ana', email: '', phone: '1', notify: true })
      b = result.current.actions.addPerson({ name: 'Bia', email: '', phone: '2', notify: true })
    })
    const t0 = allTasks(result.current.state)[0].id
    act(() => result.current.actions.setTaskOwners(t0, [a, b, a, 'fantasma']))
    expect(findTask(result.current.state, t0)).toMatchObject({
      owner: 'Ana, Bia',
      ownerId: a,
      ownerIds: [a, b],
    })
    // renomear acompanha no texto
    act(() => result.current.actions.patchPerson(b, { name: 'Beatriz' }))
    expect(findTask(result.current.state, t0)?.owner).toBe('Ana, Beatriz')
    // remover uma pessoa do cadastro mantém a outra
    act(() => result.current.actions.removePerson(a))
    expect(findTask(result.current.state, t0)).toMatchObject({
      owner: 'Beatriz',
      ownerId: b,
      ownerIds: [b],
    })
    // o caminho antigo (um só) continua coerente com a lista
    act(() => result.current.actions.patchTask(t0, { owner: 'Beatriz', ownerId: b }))
    expect(findTask(result.current.state, t0)?.ownerIds).toEqual([b])
    act(() => result.current.actions.setTaskOwners(t0, []))
    expect(findTask(result.current.state, t0)).toMatchObject({ owner: '' })
    expect(findTask(result.current.state, t0)?.ownerIds).toBeUndefined()
  })

  it('parse aceita ownerIds e deriva ownerId; estado antigo só com ownerId vira lista', () => {
    const raw = JSON.parse(JSON.stringify(buildInitialState()))
    raw.people = [
      { id: 'p1', name: 'Ana', phone: '1' },
      { id: 'p2', name: 'Bia', phone: '2' },
    ]
    raw.phases[0].areas[0].tasks[0].ownerIds = ['p2', 'p1', 'p2']
    raw.phases[0].areas[0].tasks[1].ownerId = 'p1'
    const out = parseState(raw)
    const ts = out.phases[0].areas[0].tasks
    expect(ts[0]).toMatchObject({ ownerId: 'p2', ownerIds: ['p2', 'p1'] })
    expect(ts[1]).toMatchObject({ ownerId: 'p1', ownerIds: ['p1'] })
  })
})

describe('admin', () => {
  it('cadastro guarda admin, patch tira a chave quando falso, e o parse aceita só true', () => {
    const { result } = setup()
    let id = ''
    act(() => {
      id = result.current.actions.addPerson({
        name: 'Ana',
        email: '',
        phone: '(11) 99999-0000',
        notify: true,
        admin: true,
      })
    })
    expect(result.current.state.people[0].admin).toBe(true)
    act(() => result.current.actions.patchPerson(id, { admin: false }))
    expect('admin' in result.current.state.people[0]).toBe(false)
    const raw = JSON.parse(JSON.stringify(result.current.state))
    raw.people[0].admin = 'sim'
    expect(parseState(raw).people[0].admin).toBeUndefined()
    raw.people[0].admin = true
    expect(parseState(raw).people[0].admin).toBe(true)
  })
})

describe('financeiro', () => {
  it('só existe dentro do admin: sai junto quando o admin sai', () => {
    const { result } = setup()
    let id = ''
    let semAdmin = ''
    act(() => {
      id = result.current.actions.addPerson({
        name: 'Wes',
        email: '',
        phone: '(11) 90000-0009',
        notify: true,
        admin: true,
        finance: true,
      })
      semAdmin = result.current.actions.addPerson({
        name: 'Membro',
        email: '',
        phone: '(11) 90000-0001',
        notify: true,
        finance: true,
      })
    })
    expect(result.current.state.people[0].finance).toBe(true)
    expect('finance' in result.current.state.people[1]).toBe(false)
    expect(semAdmin).not.toBe('')

    act(() => result.current.actions.patchPerson(id, { admin: false }))
    expect('finance' in result.current.state.people[0]).toBe(false)

    const raw = JSON.parse(JSON.stringify(result.current.state))
    raw.people[1].finance = true
    expect(parseState(raw).people[1].finance).toBeUndefined()
    raw.people[1].admin = true
    expect(parseState(raw).people[1].finance).toBe(true)
  })
})

describe('vários números por pessoa', () => {
  it('guarda a lista, acha a pessoa por qualquer número e mantém o principal', () => {
    const { result } = setup()
    let id = ''
    act(() => {
      id = result.current.actions.addPerson({
        name: 'Gimena',
        email: '',
        phone: '',
        phones: ['(47) 90000-0047', '+55 11 98888-7777', '(47) 90000-0047', ' '],
        notify: true,
      })
    })
    const p = result.current.state.people[0]
    expect(p).toMatchObject({
      phone: '5547900000047',
      phones: ['5547900000047', '5511988887777'],
    })
    expect(personPhones(p)).toEqual(['5547900000047', '5511988887777'])
    expect(personByPhone(result.current.state, '5511988887777')?.id).toBe(id)
    expect(personByPhone(result.current.state, '5599999999999')).toBeUndefined()

    // sobrou um número só: a lista some e fica o campo antigo
    act(() => result.current.actions.patchPerson(id, { phones: ['(47) 90000-0047'] }))
    expect(result.current.state.people[0].phone).toBe('5547900000047')
    expect('phones' in result.current.state.people[0]).toBe(false)
  })

  it('parse aceita cadastro antigo (só phone) e limpa a lista vinda do backup', () => {
    const raw = JSON.parse(JSON.stringify(buildInitialState()))
    raw.people = [
      { id: 'p1', name: 'Ana', phone: '(11) 98888-7777' },
      { id: 'p2', name: 'Bia', phone: 'lixo', phones: ['(85) 99999-0000', '', '(85) 99999-0000'] },
    ]
    const out = parseState(raw)
    expect(out.people[0]).toMatchObject({ phone: '5511988887777' })
    expect('phones' in out.people[0]).toBe(false)
    expect(out.people[1]).toMatchObject({ phone: '5585999990000' })
    expect(personPhones(out.people[1])).toEqual(['5585999990000'])
  })
})
