import { describe, expect, it } from 'vitest'
import { DEFAULT_MESSAGE_TEMPLATES, fillTemplate } from './messageTemplates'

const link = 'https://seu-painel.vercel.app/checklist?card=x'

describe('fillTemplate (mesma regra da função SQL comu_hub_fill_template)', () => {
  it('preenche tudo quando todos os valores existem', () => {
    const out = fillTemplate(DEFAULT_MESSAGE_TEMPLATES.task_assigned, {
      nome: 'Wes',
      tarefa: 'Criar grupos',
      prazo: '22/09',
      checklist: 'Task:\n❌ imagem\n✅ descricao',
      link,
      autor: 'Igor alves',
    })
    expect(out).toBe(
      'Olá, Wes! Você ficou responsável por *Criar grupos* no Comu HUB. 🔥\n\n*Prazo: 22/09.* ⏳\n\nTask:\n❌ imagem\n✅ descricao\n\nAbrir card em: https://seu-painel.vercel.app/checklist?card=x\n\nIgor alves · Comu HUB 👋',
    )
  })

  it('some com a linha do prazo e o bloco da checklist quando estão vazios', () => {
    const out = fillTemplate(DEFAULT_MESSAGE_TEMPLATES.task_assigned, {
      nome: 'Wes',
      tarefa: 'Tarefa solta',
      prazo: '',
      checklist: '',
      link,
      autor: 'Igor alves',
    })
    expect(out).toBe(
      'Olá, Wes! Você ficou responsável por *Tarefa solta* no Comu HUB. 🔥\n\nAbrir card em: https://seu-painel.vercel.app/checklist?card=x\n\nIgor alves · Comu HUB 👋',
    )
  })

  it('sem autor, a assinatura vira só "Comu HUB"', () => {
    const out = fillTemplate(DEFAULT_MESSAGE_TEMPLATES.due_today, {
      nome: 'Wes',
      tarefa: 'Tarefa solta',
      prazo: '18/09',
      checklist: '',
      link,
      autor: '',
    })
    expect(out.endsWith('\n\nComu HUB 👋')).toBe(true)
    expect(out).not.toContain('·')
  })

  it('boas-vindas sem autor tira o ", por" e mantém a frase', () => {
    const out = fillTemplate(DEFAULT_MESSAGE_TEMPLATES.welcome, {
      nome: 'Wes',
      link: 'https://seu-painel.vercel.app',
      autor: '',
    })
    expect(out).toContain('o painel do lançamento.\n')
    expect(out).not.toContain(', por')
  })

  it('reunião sem link some com a linha "Entrar:"', () => {
    const out = fillTemplate(DEFAULT_MESSAGE_TEMPLATES.meeting, {
      nome: 'Wes',
      reuniao: 'Weekly',
      quando: '25/09 às 10:00',
      link: '',
      autor: 'Wes',
    })
    expect(out).toBe(
      'Olá, Wes! Reunião marcada: *Weekly*. 📅\n\n*Quando: 25/09 às 10:00.*\n\nWes · Comu HUB 👋',
    )
  })

  it('texto livre do usuário: placeholder desconhecido fica como está', () => {
    expect(fillTemplate('Oi {nome}, veja {coisa}', { nome: 'Ana' })).toBe('Oi Ana, veja {coisa}')
  })
})
