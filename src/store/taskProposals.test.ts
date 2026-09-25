import { describe, expect, it } from 'vitest'
import type { Meeting } from '../data/types'
import { buildInitialState } from './launchStore'
import { matchPerson, resolveProposal } from './taskProposals'

const people = [
  { id: 'p1', name: 'Igor Alves', email: '', phone: '1', notify: true },
  { id: 'p2', name: 'Gabriel Lima', email: '', phone: '2', notify: true },
  { id: 'p3', name: 'Gabriel Lira', email: '', phone: '3', notify: true },
]

const meeting: Meeting = {
  id: 'm1',
  title: 'Weekly',
  date: '2026-09-18',
  time: '10:00',
  durationMin: 60,
  link: '',
  agenda: '',
}

describe('matchPerson', () => {
  it('casa nome inteiro, primeiro nome único, e ignora acento e caixa', () => {
    expect(matchPerson('igor alves', people)?.id).toBe('p1')
    expect(matchPerson('Ígor', people)?.id).toBe('p1')
    expect(matchPerson('Gabriel', people)).toBeUndefined()
    expect(matchPerson('Gabriel Lira', people)?.id).toBe('p3')
    expect(matchPerson('Tamara', people)).toBeUndefined()
  })
})

describe('resolveProposal', () => {
  const s = { ...buildInitialState('2026-09-18'), people }
  const f0 = s.phases[0]

  it('usa fase, área e pessoa quando batem com o painel', () => {
    const p = resolveProposal(
      {
        titulo: 'Pedir termos ao jurídico',
        acao: 'Prazos de entrega dos brindes.',
        responsavel: 'Igor',
        area: f0.areas[0].name.toLowerCase(),
        fase: f0.id,
        prazo: '2026-09-24',
        checklist: ['Pedir minuta', '', 'Revisar'],
      },
      0,
      s,
      meeting,
      '2026-09-18',
    )
    expect(p).toMatchObject({
      title: 'Pedir termos ao jurídico',
      ownerName: 'Igor Alves',
      ownerId: 'p1',
      phaseId: f0.id,
      areaId: f0.areas[0].id,
      due: '2026-09-24',
      checklist: ['Pedir minuta', 'Revisar'],
    })
  })

  it('sem fase válida cai na fase da data da reunião; área desconhecida vira "new:"; prazo inválido some', () => {
    const byDate = s.phases.find((ph) => ph.start <= meeting.date && meeting.date <= ph.end)!
    const p = resolveProposal(
      { titulo: 'X', responsavel: 'Tamara', area: 'jurídico', fase: 'nope', prazo: 'sexta' },
      1,
      s,
      meeting,
      '2026-09-18',
    )
    expect(p).toMatchObject({
      phaseId: byDate.id,
      areaId: 'new:JURÍDICO',
      ownerName: 'Tamara',
      ownerId: '',
      due: '',
      checklist: [],
    })
  })

  it('sem título não vira proposta', () => {
    expect(resolveProposal({ titulo: '  ' }, 2, s, meeting, '2026-09-18')).toBeNull()
  })
})
