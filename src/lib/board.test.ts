import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from './board'

describe('endereço do quadro', () => {
  it('aceita só minúsculas, números e hífen, e recusa caminho reservado', () => {
    expect(isValidSlug('aurora')).toBe(true)
    expect(isValidSlug('estudio-aurora-2')).toBe(true)
    expect(isValidSlug('a')).toBe(false)
    expect(isValidSlug('-aurora')).toBe(false)
    expect(isValidSlug('Aurora')).toBe(false)
    expect(isValidSlug('deni se')).toBe(false)
    expect(isValidSlug('novo')).toBe(false)
    expect(isValidSlug('verificador')).toBe(false)
    expect(isValidSlug('assets')).toBe(false)
    expect(isValidSlug('a'.repeat(41))).toBe(false)
  })

  it('sugere endereço a partir do nome, sem acento nem sobra de hífen', () => {
    expect(slugify('Estúdio Aurora')).toBe('estudio-aurora')
    expect(slugify('  Lançamento 2026!  ')).toBe('lancamento-2026')
    expect(slugify('Rick & Co.')).toBe('rick-co')
    expect(slugify('Ação')).toBe('acao')
    expect(isValidSlug(slugify('Comu Academy'))).toBe(true)
  })
})
