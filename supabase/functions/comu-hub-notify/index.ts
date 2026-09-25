// Comu HUB · envia a fila de avisos (comu_hub_notifications) pelo WhatsApp via Evolution GO.
// Chamada a cada minuto pelo pg_cron enquanto houver itens na fila e o envio estiver ligado.
// Segredos (Supabase → Edge Functions → Secrets):
//   EVOLUTION_URL     base da API, sem /mcp no fim (ex.: https://sua-evolution.exemplo.com)
//   EVOLUTION_APIKEY  token da instância (header `apikey`)
// Opcionais: EVOLUTION_SEND_PATH (padrão /send/text, o endpoint do Evolution GO; na Evolution API v2
//   use /message/sendText/{instance}) e EVOLUTION_INSTANCE (substitui {instance} no caminho).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface Row {
  id: number
  phone: string
  message: string
  attempts: number
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async () => {
  const url = Deno.env.get('EVOLUTION_URL')?.replace(/\/(mcp\/?)?$/, '')
  const apikey = Deno.env.get('EVOLUTION_APIKEY')
  const instance = Deno.env.get('EVOLUTION_INSTANCE') ?? ''
  const sendPath = (Deno.env.get('EVOLUTION_SEND_PATH') ?? '/send/text').replace('{instance}', instance)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const configured = !!(url && apikey)
  await sb.from('comu_hub_settings').upsert({ key: 'whatsapp_configured', value: configured ? 'true' : 'false' })
  if (!configured) return json({ configured: false, sent: 0 })

  const { data, error } = await sb
    .from('comu_hub_notifications')
    .select('id,phone,message,attempts')
    .eq('status', 'queued')
    .order('id')
    .limit(20)
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  let failed = 0
  for (const row of (data ?? []) as Row[]) {
    try {
      const res = await fetch(`${url}${sendPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body: JSON.stringify({ number: row.phone, text: row.message }),
      })
      if (!res.ok) throw new Error(`Evolution ${res.status}: ${(await res.text()).slice(0, 200)}`)
      await sb.rpc('comu_hub_mark_notification', { p_id: row.id, p_status: 'sent', p_error: null })
      sent++
      // pausa curta entre envios para não parecer disparo em massa
      await new Promise((r) => setTimeout(r, 1500))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = row.attempts + 1 >= 3 ? 'failed' : 'queued'
      await sb.rpc('comu_hub_mark_notification', { p_id: row.id, p_status: status, p_error: msg })
      failed++
    }
  }
  return json({ configured: true, sent, failed })
})
