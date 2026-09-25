import { describe, expect, it } from 'vitest'
import { extractDue, parseActionItems } from './actionItems'

const ATA = `📋 Lançamento Exemplo
🗓 18/09 · 09h57

📝 Resumo
Reunião de organização.

💬 Discussão Aberta
•⁠  ⁠Prazo de entrega de kits: Carla pede 60 dias

▶️ Itens de Ação & Próximos Passos
Paulo:
– Compartilhar link do novo painel e cadastrar usuários/responsáveis
– Criar página de captura + instruções de conteúdo (até 24/09)
Carla:
– Pedir termos e condições ao jurídico (com prazos de entrega de kits)
  incluindo cláusula de 60 dias
Rafa/Lu:
– Validar criadoras, autorizar roteiros e alinhar automações técnicas com Téo antes de 21/09
Time comercial (Júlia sugerida):
– Planejar estrutura pós-compra: funil, CRM e contato de up-sell

💡 Notas & Principais Conclusões
•⁠  ⁠Afiliados: comissão a definir`

describe('parseActionItems', () => {
  it('lê responsável por bloco, itens, continuação e prazo dd/mm', () => {
    const items = parseActionItems(ATA, '2026-09-18')
    expect(items.map((i) => [i.responsavel, i.titulo, i.prazo])).toEqual([
      ['Paulo', 'Compartilhar link do novo painel e cadastrar usuários/responsáveis', null],
      ['Paulo', 'Criar página de captura + instruções de conteúdo', '2026-09-24'],
      ['Carla', 'Pedir termos e condições ao jurídico', null],
      [
        'Rafa/Lu',
        'Validar criadoras, autorizar roteiros e alinhar automações técnicas com Téo…',
        '2026-09-21',
      ],
      ['Time comercial (Júlia sugerida)', 'Planejar estrutura pós-compra', null],
    ])
    expect(items[4].acao).toBe('Planejar estrutura pós-compra: funil, CRM e contato de up-sell')
    expect(items[2].acao).toContain('incluindo cláusula de 60 dias')
    expect(items[0].acao).toBe('')
  })

  it('sem bloco de dono, aceita "• Nome: tarefa" na mesma linha', () => {
    const items = parseActionItems(
      'Próximos passos:\n• Igor: Subir tarefas no painel\n• Revisar copy',
      '2026-09-18',
    )
    expect(items.map((i) => [i.responsavel, i.titulo])).toEqual([
      ['Igor', 'Subir tarefas no painel'],
      [null, 'Revisar copy'],
    ])
  })

  it('sem o bloco, devolve vazio', () => {
    expect(parseActionItems('📝 Resumo\nnada aqui', '2026-09-18')).toEqual([])
  })

  it('extractDue usa o ano da reunião e pula para o ano seguinte quando a data já passou', () => {
    expect(extractDue('até 24/09', '2026-09-18')).toBe('2026-09-24')
    expect(extractDue('dia 05/01', '2026-09-18')).toBe('2027-01-05')
    expect(extractDue('em 31/02', '2026-09-18')).toBe('')
    expect(extractDue('sem data', '2026-09-18')).toBe('')
    expect(extractDue('12/10/25', '2026-09-18')).toBe('2025-10-12')
  })
})
