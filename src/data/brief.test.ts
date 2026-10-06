import { describe, expect, it } from 'vitest'
import {
  BRIEF_MODEL_KEY,
  BRIEF_SECTIONS,
  briefModelOf,
  briefSectionsFor,
  PERPETUO_BRIEF_SECTIONS,
  QUICK_LINK_FIELDS,
} from './brief'

describe('brief do perpétuo', () => {
  it('o modelo vem do próprio brief; sem escolha é lançamento', () => {
    expect(briefModelOf({})).toBe('lancamento')
    expect(briefModelOf({ [BRIEF_MODEL_KEY]: 'perpetuo' })).toBe('perpetuo')
    expect(briefSectionsFor('lancamento')).toBe(BRIEF_SECTIONS)
    expect(briefSectionsFor('perpetuo')).toBe(PERPETUO_BRIEF_SECTIONS)
  })

  it('ids do perpétuo não colidem com os do lançamento nem entre si', () => {
    const launch = new Set(BRIEF_SECTIONS.flatMap((s) => s.fields.map((f) => f.id)))
    const perp = PERPETUO_BRIEF_SECTIONS.flatMap((s) => s.fields.map((f) => f.id))
    expect(new Set(perp).size).toBe(perp.length)
    expect(perp.filter((id) => launch.has(id))).toEqual([])
  })

  it('atalhos do Painel são os links de Acessos rápidos e Funil, na ordem do brief', () => {
    expect(QUICK_LINK_FIELDS[0].id).toBe('pDrive')
    expect(QUICK_LINK_FIELDS.every((f) => f.kind === 'link')).toBe(true)
    expect(QUICK_LINK_FIELDS.map((f) => f.id)).toContain('pPaginaVendas')
  })
})
