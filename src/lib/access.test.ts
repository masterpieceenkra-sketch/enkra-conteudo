import { describe, expect, it } from 'vitest'
import { accessFor, accessLabel, formatWhen } from './access'

const now = new Date(2026, 8, 28, 15, 0)
const at = (d: number, h: number, m: number, y = 2026) => new Date(y, 8, d, h, m).toISOString()

describe('último acesso', () => {
  it('formata hoje, ontem, data e ano diferente', () => {
    expect(formatWhen(at(28, 12, 20), now)).toBe('hoje às 12:20')
    expect(formatWhen(at(27, 9, 5), now)).toBe('ontem às 09:05')
    expect(formatWhen(at(20, 18, 0), now)).toBe('20/09 às 18:00')
    expect(formatWhen(at(20, 18, 0, 2025), now)).toBe('20/09/2025 às 18:00')
  })

  it('junta os números da pessoa e pega o mais recente', () => {
    const map = new Map([
      ['5585911112222', { seen: at(20, 10, 0), code: null }],
      ['5585933334444', { seen: at(27, 9, 5), code: at(27, 9, 4) }],
    ])
    expect(accessFor(map, ['5585911112222', '5585933334444'])).toEqual({
      seen: at(27, 9, 5),
      code: at(27, 9, 4),
    })
    expect(accessFor(map, ['5500000000000'])).toEqual({ seen: null, code: null })
  })

  it('diz quando a pessoa ainda não entrou e se pediu código', () => {
    expect(accessLabel({ seen: at(28, 12, 20), code: null }, now)).toBe(
      'Último acesso hoje às 12:20',
    )
    expect(accessLabel({ seen: null, code: at(28, 12, 19) }, now)).toBe(
      'Ainda não entrou · código enviado hoje às 12:19',
    )
    expect(accessLabel({ seen: null, code: null }, now)).toBe('Ainda não entrou')
  })
})
