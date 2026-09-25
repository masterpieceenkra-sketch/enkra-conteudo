// Comu HUB · lê a ata/resumo de uma reunião e propõe cards (tarefa, responsável, área, fase, prazo, checklist).
// Chamada pelo painel (botão "Com IA" no resumo da reunião). Nada é gravado: o painel mostra as propostas e
// só cria o card quando a pessoa aceita.
// Segredos (Supabase → Edge Functions → Secrets), um dos dois:
//   OPENROUTER_API_KEY  (preferido; modelo em COMU_HUB_AI_MODEL, padrão anthropic/claude-sonnet-5)
//   ANTHROPIC_API_KEY   (direto na Anthropic; modelo padrão claude-sonnet-5)
// Exige sessão (Authorization: Bearer <token do login>) de alguém que está no cadastro do lançamento.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const DAILY_LIMIT = Number(Deno.env.get('COMU_HUB_AI_DAILY_LIMIT') ?? '40')
const MAX_CHARS = 40_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-comu-launch',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

interface Person {
  id: string
  name: string
  role?: string
}
interface Phase {
  id: string
  name: string
  start: string
  end: string
  areas: string[]
}
interface Input {
  launchId: string
  actor?: string
  summary: string
  meetingTitle: string
  meetingDate: string
  today: string
  people: Person[]
  phases: Phase[]
}

/** Números da pessoa: lista `phones` quando existe, senão o `phone` principal. */
function personPhones(p: { phone?: string; phones?: unknown }): string[] {
  const list = Array.isArray(p.phones) && p.phones.length ? p.phones : [p.phone]
  return list.filter((v): v is string => typeof v === 'string' && v !== '')
}

const TOOL_NAME = 'propor_tarefas'
const TOOL_DESC = 'Devolve as tarefas identificadas na ata, uma por card.'
const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    tarefas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título curto do card, no infinitivo (ex.: "Pedir termos ao jurídico"). Até 90 caracteres.' },
          acao: { type: 'string', description: 'O que exatamente precisa ser feito e o contexto da ata, em 1 a 3 frases. Vai para a descrição do card.' },
          responsavel: { type: ['string', 'null'], description: 'Nome de quem ficou responsável. Se for alguém da lista de pessoas do time, use EXATAMENTE o nome da lista. Null se a ata não deixa claro.' },
          area: { type: ['string', 'null'], description: 'Uma das áreas fornecidas (nome exato). Null se nenhuma encaixa.' },
          fase: { type: ['string', 'null'], description: 'id de uma das fases fornecidas, escolhida pela data ou pelo tema. Null se não dá para saber.' },
          prazo: { type: ['string', 'null'], description: 'Data limite em YYYY-MM-DD, só quando a ata dá uma data ou um prazo claro ("até sexta", "antes do dia 21"). Null quando não há.' },
          checklist: { type: 'array', items: { type: 'string' }, description: 'Passos concretos citados na ata para essa tarefa, quando houver mais de um. Vazio se não houver.' },
        },
        required: ['titulo', 'acao', 'responsavel', 'area', 'fase', 'prazo', 'checklist'],
      },
    },
  },
  required: ['tarefas'],
}

function buildPrompt(i: Input): string {
  const people = i.people.length
    ? i.people.map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`).join('\n')
    : '- (nenhuma pessoa cadastrada)'
  const phases = i.phases
    .map((p) => `- id "${p.id}": ${p.name}, de ${p.start} a ${p.end}. Áreas: ${p.areas.join(', ') || '(nenhuma)'}`)
    .join('\n')
  return `Você organiza o checklist de um lançamento digital (o "Comu HUB"). Leia a ata da reunião abaixo e identifique as TAREFAS concretas que alguém precisa executar, para virarem cards no checklist.

Regras:
- Uma tarefa = uma ação executável com dono claro ou provável. Decisões, contexto e discussões NÃO são tarefas.
- Não invente tarefas. Só o que a ata diz ou implica claramente. Se a ata tem uma seção de "tarefas"/"próximos passos", parta dela.
- Não repita a mesma tarefa em cards diferentes. Junte passos da mesma entrega como checklist de um card só.
- Responsável: se a ata nomeia alguém que está na lista do time (mesmo com apelido ou só o primeiro nome), use EXATAMENTE o nome como está na lista. Se a pessoa não está na lista, use o nome como aparece na ata. Se não há dono, null.
- Área: escolha entre as áreas fornecidas (nome exato). Fase: escolha o id da fase pelo prazo (data dentro do período) ou pelo tema; na dúvida entre duas, a mais próxima da data da reunião.
- Prazo: só quando a ata dá uma data ou prazo explícito. Converta prazos relativos usando a data da reunião (${i.meetingDate}); hoje é ${i.today}. Formato YYYY-MM-DD.
- Títulos curtos, no infinitivo, em português do Brasil. Sem travessão.
- Devolva as tarefas pela ferramenta ${TOOL_NAME}. Se não houver nenhuma tarefa, devolva a lista vazia.

Pessoas do time:
${people}

Fases e áreas do lançamento:
${phases}

Reunião: ${i.meetingTitle} (${i.meetingDate})

ATA:
<<<
${i.summary}
>>>`
}

interface Usage {
  input_tokens: number
  output_tokens: number
}
interface Provider {
  name: string
  model: string
  call(prompt: string): Promise<{ tarefas: unknown[]; usage: Usage }>
}

function openrouter(key: string): Provider {
  const model = Deno.env.get('COMU_HUB_AI_MODEL') ?? 'anthropic/claude-sonnet-5'
  return {
    name: 'openrouter',
    model,
    async call(prompt) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'X-Title': 'Comu HUB',
        },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          messages: [{ role: 'user', content: prompt }],
          tools: [{ type: 'function', function: { name: TOOL_NAME, description: TOOL_DESC, parameters: TOOL_SCHEMA } }],
          tool_choice: { type: 'function', function: { name: TOOL_NAME } },
        }),
      })
      if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
      const body = await res.json()
      const call = body.choices?.[0]?.message?.tool_calls?.find(
        (c: { function?: { name?: string } }) => c.function?.name === TOOL_NAME,
      )
      let parsed: { tarefas?: unknown[] } = {}
      try {
        parsed = JSON.parse(call?.function?.arguments ?? '{}')
      } catch {
        parsed = {}
      }
      return {
        tarefas: parsed.tarefas ?? [],
        usage: { input_tokens: body.usage?.prompt_tokens ?? 0, output_tokens: body.usage?.completion_tokens ?? 0 },
      }
    },
  }
}

function anthropic(key: string): Provider {
  const model = Deno.env.get('COMU_HUB_AI_MODEL') ?? 'claude-sonnet-5'
  return {
    name: 'anthropic',
    model,
    async call(prompt) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          tools: [{ name: TOOL_NAME, description: TOOL_DESC, input_schema: TOOL_SCHEMA }],
          tool_choice: { type: 'tool', name: TOOL_NAME },
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
      const body = await res.json()
      const tool = (body.content as { type: string; name?: string; input?: { tarefas?: unknown[] } }[]).find(
        (c) => c.type === 'tool_use' && c.name === TOOL_NAME,
      )
      return {
        tarefas: tool?.input?.tarefas ?? [],
        usage: { input_tokens: body.usage?.input_tokens ?? 0, output_tokens: body.usage?.output_tokens ?? 0 },
      }
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método inválido' }, 405)

  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  const anKey = Deno.env.get('ANTHROPIC_API_KEY')
  const provider = orKey ? openrouter(orKey) : anKey ? anthropic(anKey) : null
  if (!provider)
    return json(
      { error: 'IA não configurada. Cole OPENROUTER_API_KEY (ou ANTHROPIC_API_KEY) nos Secrets das Edge Functions do Supabase.' },
      503,
    )

  let input: Input
  try {
    input = (await req.json()) as Input
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const summary = (input.summary ?? '').trim()
  if (!input.launchId || input.launchId.length > 64) return json({ error: 'lançamento inválido' }, 400)
  if (summary.length < 40) return json({ error: 'O resumo está curto demais para identificar tarefas.' }, 400)
  if (summary.length > MAX_CHARS) return json({ error: `Resumo grande demais (máx. ${MAX_CHARS} caracteres).` }, 400)

  // Quem chamou: sessão do login, com telefone em app_metadata; precisa estar no cadastro do lançamento.
  const authz = req.headers.get('Authorization') ?? ''
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authz } },
  })
  const { data: userData } = await userClient.auth.getUser()
  const phone = (userData?.user?.app_metadata as { phone?: string } | undefined)?.phone ?? ''
  if (!phone) return json({ error: 'Faça login para usar a IA.' }, 401)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: launch } = await sb.from('comu_hub_launches').select('id,state').eq('id', input.launchId).maybeSingle()
  if (!launch) return json({ error: 'lançamento não encontrado' }, 404)
  const member = ((launch.state as { people?: { phone?: string; phones?: string[]; name?: string }[] }).people ?? []).find((p) =>
    personPhones(p).includes(phone),
  )
  if (!member) return json({ error: 'Seu número não está no cadastro deste lançamento.' }, 403)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await sb
    .from('comu_hub_ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('launch_id', input.launchId)
    .is('error', null)
    .gte('at', since)
  if ((count ?? 0) >= DAILY_LIMIT)
    return json({ error: `Limite de ${DAILY_LIMIT} identificações por dia atingido. Tente amanhã.` }, 429)

  const actor = (member.name ?? input.actor ?? '').slice(0, 80)
  const log = async (fields: Record<string, unknown>) => {
    await sb.from('comu_hub_ai_calls').insert({
      launch_id: input.launchId,
      kind: 'extract_tasks',
      actor,
      input_chars: summary.length,
      model: `${provider.name}:${provider.model}`,
      ...fields,
    })
  }

  try {
    const r = await provider.call(buildPrompt({ ...input, summary }))
    const tarefas = r.tarefas.filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    await log({ output_items: tarefas.length, input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens })
    return json({ tarefas, usage: r.usage })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await log({ error: msg })
    const auth = /\b(401|403)\b/.test(msg)
    return json(
      { error: auth ? 'A chave da IA foi recusada. Confira o segredo no Supabase.' : 'A IA não respondeu. Tente de novo em instantes.' },
      502,
    )
  }
})
