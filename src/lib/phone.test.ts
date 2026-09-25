import { describe, expect, it } from 'vitest'
import { formatBr, parseAdminNumbers, waLink } from './phone'

describe('números dos admins', () => {
  it('lê um número por linha, com ou sem nome, e ignora lixo', () => {
    const list = parseAdminNumbers(
      `+55 85 99999-0000 · Igor\n(11) 98888-7777 - Bruna\n\nabc\n5585977776666`,
    )
    expect(list.map((n) => [n.digits, n.name])).toEqual([
      ['5585999990000', 'Igor'],
      ['11988887777', 'Bruna'],
      ['5585977776666', ''],
    ])
  })
  it('formata e monta o link do WhatsApp', () => {
    expect(formatBr('5585999990000')).toBe('+55 (85) 99999-0000')
    expect(formatBr('11988887777')).toBe('+55 (11) 98888-7777')
    expect(formatBr('12345678')).toBe('+12345678')
    expect(waLink('11988887777')).toBe('https://wa.me/5511988887777')
  })
})
