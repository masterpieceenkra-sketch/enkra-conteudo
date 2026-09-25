// Comu HUB · login por código no WhatsApp.
//   POST { action: 'request', launchId?, phone }        → gera código de 6 dígitos, guarda o hash e envia pela Evolution.
//   POST { action: 'verify',  launchId?, phone, code }  → confere; garante o usuário no Auth (e-mail interno, telefone em
//                                                        app_metadata) e devolve token_hash para o painel abrir a sessão.
// Só telefones que estão em Usuários recebem código (qualquer um dos números da pessoa serve).
// Sem `launchId` (raiz do hub, onde ainda não se sabe o quadro) o servidor procura o telefone em
// qualquer quadro. Público (sem JWT), com limites por telefone.
// Segredos: EVOLUTION_URL, EVOLUTION_APIKEY (opcionais EVOLUTION_SEND_PATH, EVOLUTION_INSTANCE,
// APP_NAME para o nome na mensagem do código e LOGIN_EMAIL_DOMAIN para o e-mail interno).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CODE_TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MIN_INTERVAL_S = 45
const MAX_PER_HOUR = 5

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } })

function normalizePhone(v: string): string {
  let d = (v ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = `55${d}`
  return d
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** E-mail interno do Auth (ninguém recebe e-mail); o domínio pode ser trocado por LOGIN_EMAIL_DOMAIN. */
function internalEmail(phone: string): string {
  return `wa-${phone}@${Deno.env.get('LOGIN_EMAIL_DOMAIN') ?? 'login.example.com'}`
}

/** Chave dos códigos de quem administra a plataforma e ainda não está em quadro nenhum. */
const OWNER_KEY = '_plataforma'

// deno-lint-ignore no-explicit-any
async function isPlatformOwner(sb: any, phone: string): Promise<boolean> {
  const { data } = await sb.from('comu_hub_settings').select('value').eq('key', 'platform_owners').maybeSingle()
  try {
    const list = JSON.parse(data?.value || '[]')
    return Array.isArray(list) && list.map(String).includes(phone)
  } catch {
    return false
  }
}

/** Números da pessoa: lista `phones` quando existe, senão o `phone` principal. */
function personPhones(p: { phone?: string; phones?: unknown }): string[] {
  const list = Array.isArray(p.phones) && p.phones.length ? p.phones : [p.phone]
  return list.filter((v): v is string => typeof v === 'string' && v !== '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'método inválido' }, 405)

  let body: { action?: string; launchId?: string; phone?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const phone = normalizePhone(body.phone ?? '')
  if (phone.length < 12 || phone.length > 15) return json({ error: 'Digite o WhatsApp com DDD.' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Resposta igual para número fora do cadastro: não revela quem está na lista.
  const generic = 'Se esse número estiver no cadastro do time, o código chega no WhatsApp em instantes.'

  // Qual quadro guarda o código: o da URL, ou o primeiro em que o telefone estiver.
  // Quem administra a plataforma (platform_owners) entra mesmo sem quadro nenhum: é assim que
  // a instalação nova cria o primeiro quadro.
  let launchId = (body.launchId ?? '').slice(0, 64)
  if (!launchId) {
    const { data: found } = await sb.rpc('comu_hub_launch_for_phone', { p_phone: phone })
    launchId = typeof found === 'string' ? found : ''
    if (!launchId && (await isPlatformOwner(sb, phone))) launchId = OWNER_KEY
    if (!launchId) {
      if (body.action === 'request') return json({ ok: true, message: generic })
      return json({ error: 'Código inválido ou vencido.' }, 401)
    }
  }

  let person: { name?: string } | undefined
  let boardName = ''
  if (launchId === OWNER_KEY) {
    person = { name: '' }
  } else {
    const { data: launch } = await sb.from('comu_hub_launches').select('state').eq('id', launchId).maybeSingle()
    if (!launch) return json({ error: 'quadro não encontrado' }, 404)
    const state = launch.state as { name?: string; people?: { phone?: string; phones?: string[]; name?: string }[] }
    person = (state.people ?? []).find((p) => personPhones(p).includes(phone))
    boardName = (state.name ?? '').trim()
  }

  if (body.action === 'request') {
    if (!person) return json({ ok: true, message: generic })
    const since = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recent } = await sb
      .from('comu_hub_login_codes')
      .select('created_at')
      .eq('launch_id', launchId)
      .eq('phone', phone)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const last = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0
    if (Date.now() - last < MIN_INTERVAL_S * 1000)
      return json({ error: `Aguarde ${MIN_INTERVAL_S} segundos para pedir outro código.` }, 429)
    if ((recent?.length ?? 0) >= MAX_PER_HOUR)
      return json({ error: 'Muitos códigos pedidos. Tente de novo em uma hora.' }, 429)

    const url = Deno.env.get('EVOLUTION_URL')?.replace(/\/(mcp\/?)?$/, '')
    const apikey = Deno.env.get('EVOLUTION_APIKEY')
    if (!url || !apikey) return json({ error: 'Envio de WhatsApp não configurado no servidor.' }, 503)

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
    const codeHash = await sha256(`${launchId}:${phone}:${code}`)
    const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString()
    await sb.from('comu_hub_login_codes').update({ used_at: new Date().toISOString() })
      .eq('launch_id', launchId).eq('phone', phone).is('used_at', null)
    const { error: insErr } = await sb
      .from('comu_hub_login_codes')
      .insert({ launch_id: launchId, phone, code_hash: codeHash, expires_at: expiresAt })
    if (insErr) return json({ error: 'Falha ao gerar o código. Tente de novo.' }, 500)

    const first = (person.name ?? '').trim().split(/\s+/)[0]
    const painel = boardName || Deno.env.get('APP_NAME') || 'Enkra Conteúdo'
    const text = `Olá${first ? `, ${first}` : ''}! Seu código para entrar no *${painel}* é:\n\n*${code}*\n\nVale por ${CODE_TTL_MIN} minutos. Se não foi você, ignore esta mensagem.`
    const sendPath = (Deno.env.get('EVOLUTION_SEND_PATH') ?? '/send/text').replace('{instance}', Deno.env.get('EVOLUTION_INSTANCE') ?? '')
    try {
      const res = await fetch(`${url}${sendPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body: JSON.stringify({ number: phone, text }),
      })
      if (!res.ok) throw new Error(`Evolution ${res.status}`)
    } catch {
      return json({ error: 'Não consegui enviar o código no WhatsApp agora. Tente de novo em instantes.' }, 502)
    }
    return json({ ok: true, message: generic })
  }

  if (body.action === 'verify') {
    const code = (body.code ?? '').replace(/\D/g, '')
    if (code.length !== 6) return json({ error: 'O código tem 6 dígitos.' }, 400)
    if (!person) return json({ error: 'Código inválido ou vencido.' }, 401)
    const { data: row } = await sb
      .from('comu_hub_login_codes')
      .select('id,code_hash,expires_at,attempts')
      .eq('launch_id', launchId)
      .eq('phone', phone)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return json({ error: 'Código vencido. Peça um novo.' }, 401)
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: 'Muitas tentativas. Peça um novo código.' }, 401)
    const ok = (await sha256(`${launchId}:${phone}:${code}`)) === row.code_hash
    if (!ok) {
      await sb.from('comu_hub_login_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
      return json({ error: `Código incorreto. ${MAX_ATTEMPTS - row.attempts - 1} tentativa(s) restante(s).` }, 401)
    }
    await sb.from('comu_hub_login_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id)

    // Usuário do Auth para este telefone (e-mail interno; ninguém recebe e-mail).
    const email = internalEmail(phone)
    let userId: string | null = null
    const { data: link } = await sb.from('comu_hub_auth_users').select('user_id').eq('phone', phone).maybeSingle()
    if (link?.user_id) userId = link.user_id
    if (!userId) {
      const { data: created, error: cErr } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { phone },
        user_metadata: { name: person.name ?? '' },
      })
      if (cErr || !created.user) return json({ error: 'Não consegui criar sua sessão. Tente de novo.' }, 500)
      userId = created.user.id
      await sb.from('comu_hub_auth_users').insert({ phone, user_id: userId })
    } else {
      // mantém o telefone no app_metadata (fonte das permissões) e o nome atualizado
      await sb.auth.admin.updateUserById(userId, { app_metadata: { phone }, user_metadata: { name: person.name ?? '' } })
    }
    const { data: gen, error: gErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email })
    if (gErr || !gen.properties?.hashed_token) return json({ error: 'Não consegui abrir sua sessão. Tente de novo.' }, 500)
    return json({ ok: true, token_hash: gen.properties.hashed_token, name: person.name ?? '' })
  }

  return json({ error: 'ação inválida' }, 400)
})
