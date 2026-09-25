import { describe, expect, it } from 'vitest'
import type { Person } from '../data/types'
import {
  byOwner,
  byPhase,
  distribution,
  isLate,
  notificationStats,
  overallStats,
  ownerLabel,
  ownerMatches,
  resolveOwner,
  resolveOwners,
  statsOf,
  UNASSIGNED_KEY,
  UNASSIGNED_LABEL,
  dueSoonTasks,
  isDueSoon,
} from './analytics'
import { allTasks, buildInitialState } from './launchStore'

const today = '2026-09-18'
const task = (over: Partial<ReturnType<typeof allTasks>[number]> = {}) => ({
  id: 'x',
  label: 'x',
  done: false,
  owner: '',
  due: '',
  ...over,
})
const people: Person[] = [
  { id: 'p1', name: 'Léo Silva', email: '', phone: '', role: 'Copy', notify: true },
  { id: 'p2', name: 'Ana', email: '', phone: '', notify: true },
]

describe('statsOf / overallStats / distribution', () => {
  it('atrasada só quando não concluída e prazo anterior a hoje', () => {
    expect(isLate(task({ due: '2026-09-17' }), today)).toBe(true)
    expect(isLate(task({ due: '2026-09-18' }), today)).toBe(false)
    expect(isLate(task({ due: '' }), today)).toBe(false)
    expect(isLate(task({ due: '2026-09-01', done: true }), today)).toBe(false)
  })

  it('concluídas + pendentes + atrasadas = total', () => {
    const st = statsOf(
      [task({ done: true }), task({ due: '2026-09-10' }), task({ due: '2026-10-10' }), task()],
      today,
    )
    expect(st).toEqual({ total: 4, done: 1, pending: 2, late: 1, pct: 25 })
    const d = distribution(st)
    expect(d.map((x) => x.label)).toEqual(['Concluídas', 'Pendentes', 'Atrasadas'])
    expect(d.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100)
  })

  it('estado vazio não gera NaN', () => {
    const s = buildInitialState(today)
    s.phases = []
    const o = overallStats(s, today)
    expect(o).toEqual({ total: 0, done: 0, pending: 0, late: 0, pct: 0, noDue: 0, soon: 0 })
    expect(distribution(o).every((x) => x.pct === 0)).toBe(true)
    expect(byOwner(s, today)).toEqual([])
    expect(byPhase(s, today)).toEqual([])
  })

  it('noDue conta pendentes sem prazo', () => {
    const s = buildInitialState(today)
    const o = overallStats(s, today)
    expect(o.noDue).toBe(o.pending)
  })
})

describe('resolveOwner', () => {
  it('cadastro por id, por nome (sem caixa/acento), texto solto e vazio', () => {
    expect(resolveOwner(task({ ownerId: 'p1', owner: 'velho' }), people)).toMatchObject({
      key: 'p:p1',
      name: 'Léo Silva',
      role: 'Copy',
    })
    expect(resolveOwner(task({ ownerId: 'sumiu', owner: 'Comu' }), people).key).toBe('t:comu')
    expect(resolveOwner(task({ owner: '  leo silva ' }), people).key).toBe('p:p1')
    expect(resolveOwner(task({ owner: 'Gimena' }), people)).toEqual({
      key: 't:gimena',
      name: 'Gimena',
    })
    expect(resolveOwner(task(), people)).toEqual({ key: UNASSIGNED_KEY, name: UNASSIGNED_LABEL })
  })
})

describe('byOwner', () => {
  it('funde grafias, ordena por total e deixa "Sem responsável" por último', () => {
    const s = buildInitialState(today)
    const ts = allTasks(s)
    for (const t of ts) t.owner = ''
    ts[0].owner = 'Comu'
    ts[1].owner = 'comu '
    ts[2].owner = 'Gimena'
    ts[2].due = '2026-09-01'
    ts[3].done = true
    ts[3].owner = 'Gimena'
    ts[4].owner = 'Gimena'
    const rows = byOwner(s, today)
    expect(rows.map((r) => r.name)).toEqual(['Gimena', 'Comu', UNASSIGNED_LABEL])
    expect(rows[0]).toMatchObject({ total: 3, done: 1, late: 1, pending: 1, pct: 33 })
    expect(rows[1].total).toBe(2)
    expect(rows.at(-1)?.unassigned).toBe(true)
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(100)
  })

  it('omite o grupo sem responsável quando todas têm dono', () => {
    const s = buildInitialState(today)
    for (const t of allTasks(s)) t.owner = 'Ana'
    expect(byOwner(s, today)).toHaveLength(1)
  })
})

describe('byPhase', () => {
  it('segue a ordem das fases e soma o total', () => {
    const s = buildInitialState(today)
    const rows = byPhase(s, today)
    expect(rows.map((r) => r.phaseId)).toEqual(s.phases.map((p) => p.id))
    expect(rows.map((r) => r.colorIndex)).toEqual(s.phases.map((_, i) => i))
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(allTasks(s).length)
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(100)
  })
})

describe('ownerMatches / ownerLabel', () => {
  it('chave e rótulo vão e voltam', () => {
    const s = buildInitialState(today)
    s.people = people
    const ts = allTasks(s)
    ts[0].owner = 'Gimena'
    ts[1].ownerId = 'p1'
    expect(ownerMatches(ts[0], 't:gimena', s.people)).toBe(true)
    expect(ownerMatches(ts[1], 'p:p1', s.people)).toBe(true)
    expect(ownerMatches(ts[1], 't:gimena', s.people)).toBe(false)
    expect(ownerLabel('t:gimena', s)).toBe('Gimena')
    expect(ownerLabel('p:p1', s)).toBe('Léo Silva')
    expect(ownerLabel(UNASSIGNED_KEY, s)).toBe(UNASSIGNED_LABEL)
    expect(ownerLabel('t:ninguem', s)).toBe('ninguem')
  })
})

describe('notificationStats', () => {
  it('conta por estado, por pessoa (nome do cadastro) e por tipo', () => {
    const rows = [
      {
        id: 1,
        kind: 'welcome',
        person_id: 'p1',
        person_name: 'Leo',
        status: 'sent',
        created_at: '2026-09-18T10:00:00Z',
      },
      {
        id: 2,
        kind: 'task_assigned',
        person_id: 'p1',
        person_name: 'Leo',
        status: 'sent',
        created_at: '2026-09-18T12:00:00Z',
      },
      {
        id: 3,
        kind: 'custom',
        person_id: 'p1',
        person_name: 'Leo',
        status: 'queued',
        created_at: '2026-09-18T13:00:00Z',
      },
      {
        id: 4,
        kind: 'welcome',
        person_id: 'sumiu',
        person_name: 'Fulano',
        status: 'sent',
        created_at: '2026-09-18T09:00:00Z',
      },
      {
        id: 5,
        kind: 'meeting',
        person_id: 'p2',
        person_name: 'Ana',
        status: 'failed',
        created_at: '2026-09-18T09:00:00Z',
      },
    ]
    const st = notificationStats(rows, people)
    expect(st).toMatchObject({
      sent: 3,
      queued: 1,
      failed: 1,
      byKind: { welcome: 2, task_assigned: 1 },
    })
    expect(st.people.map((p) => p.name)).toEqual(['Léo Silva', 'Fulano', 'Ana'])
    expect(st.people[0]).toMatchObject({
      key: 'p:p1',
      role: 'Copy',
      sent: 2,
      queued: 1,
      byKind: { welcome: 1, task_assigned: 1 },
      lastSentAt: '2026-09-18T12:00:00Z',
    })
    expect(st.people[1].key).toBe('n:fulano')
    expect(notificationStats([], people)).toEqual({
      sent: 0,
      queued: 0,
      failed: 0,
      byKind: {},
      people: [],
    })
  })
})

describe('vários responsáveis no analytics', () => {
  it('cada pessoa da lista conta a tarefa, e o filtro ?resp= casa com qualquer uma', () => {
    const t = task({ ownerIds: ['p1', 'p2'], ownerId: 'p1', owner: 'Leo Silva, Ana' })
    expect(resolveOwners(t, people).map((o) => o.key)).toEqual(['p:p1', 'p:p2'])
    expect(ownerMatches(t, 'p:p2', people)).toBe(true)
    expect(ownerMatches(t, 'p:p1', people)).toBe(true)
    expect(ownerMatches(t, 'none', people)).toBe(false)
  })
})

describe('a vencer', () => {
  it('pega o que vence de hoje até daqui a dois dias, sem atrasada nem concluída', () => {
    const s = buildInitialState('2026-09-18')
    const t = allTasks(s)
    t[0].due = '2026-09-23' // hoje
    t[1].due = '2026-09-25' // daqui a dois dias
    t[2].due = '2026-09-26' // fora da janela
    t[3].due = '2026-09-20' // atrasada
    t[4].due = '2026-09-24'
    t[4].done = true // concluída não conta
    const hoje = '2026-09-23'
    expect(dueSoonTasks(s, hoje).map((x) => x.due)).toEqual(['2026-09-23', '2026-09-25'])
    expect(overallStats(s, hoje).soon).toBe(2)
    expect(isDueSoon(t[3], hoje)).toBe(false)
    // sem prazo nunca entra
    expect(isDueSoon({ ...t[0], due: '' }, hoje)).toBe(false)
    // a janela é configurável
    expect(dueSoonTasks(s, hoje, 3).map((x) => x.due)).toEqual([
      '2026-09-23',
      '2026-09-25',
      '2026-09-26',
    ])
  })
})
