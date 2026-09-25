import type { RawProposal } from './taskProposals'

/**
 * Lê o bloco "Itens de Ação & Próximos Passos" de uma ata (formato do Tactiq e parecidos), sem IA:
 *
 *   ▶️ Itens de Ação & Próximos Passos
 *   Wesley:
 *   – Compartilhar link do novo painel
 *   Tamara:
 *   – Pedir termos ao jurídico (até 24/09)
 *
 * Também aceita "• Wesley: fazer X" na mesma linha. O bloco termina no próximo título (linha que
 * começa com emoji ou símbolo) ou no fim do texto. Datas "dd/mm" no item viram prazo.
 */

const SECTION_RE =
  /itens?\s+de\s+a[çc][ãa]o|pr[óo]ximos\s+passos|action\s+items|next\s+steps|tarefas|encaminhamentos/i
const BULLET_RE = /^\s*(?:[–—\-•·▪‣*]|\d+[.)])\s*/
const OWNER_LINE_RE = /^\s*([^:–—\-•·▪‣*][^:]{0,80}):\s*$/
const INLINE_OWNER_RE = /^([A-Za-zÀ-ú][^:]{1,60}):\s+(.+)$/

/** Linha de título de seção: começa com símbolo/emoji (não letra, número nem marcador de lista). */
function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (BULLET_RE.test(t)) return false
  return /^[^\p{L}\p{N}\s]/u.test(t)
}

/** "até 24/09", "antes de 21/09/2026", "dia 21/09" → ISO; o ano é o da reunião (ou o seguinte, se já passou). */
export function extractDue(text: string, meetingDate: string): string {
  const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(text)
  if (!m) return ''
  const day = Number(m[1])
  const month = Number(m[2])
  if (day < 1 || day > 31 || month < 1 || month > 12) return ''
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(meetingDate.slice(0, 4))
  const iso = (y: number) =>
    `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (!m[3] && iso(year) < meetingDate) year += 1
  const out = iso(year)
  const d = new Date(`${out}T12:00:00`)
  return d.getUTCMonth() + 1 === month && d.getUTCDate() === day ? out : ''
}

function cleanItem(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*[–—-]\s*$/, '')
    .trim()
}

/** Divide o item em título curto e ação completa: até o primeiro " (" ou ": ", limitando a 90 caracteres. */
function splitTitle(text: string): { titulo: string; acao: string } {
  let cut = text.length
  for (const sep of [' (', ': ', ' — ', ' – ', '; ']) {
    const i = text.indexOf(sep)
    if (i > 12 && i < cut) cut = i
  }
  let titulo = text.slice(0, cut).trim()
  if (titulo.length > 80) {
    const sp = titulo.lastIndexOf(' ', 78)
    titulo = `${titulo.slice(0, sp > 40 ? sp : 78).trim()}…`
  }
  titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1)
  return { titulo, acao: titulo === text ? '' : text }
}

export function parseActionItems(summary: string, meetingDate: string): RawProposal[] {
  const lines = summary.split(/\r?\n/)
  let start = lines.findIndex((l) => isHeading(l) && SECTION_RE.test(l))
  if (start === -1) start = lines.findIndex((l) => SECTION_RE.test(l) && /:\s*$/.test(l.trim()))
  if (start === -1) return []
  const out: RawProposal[] = []
  let owner: string | null = null
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i]
    if (isHeading(raw)) break
    const line = raw.replace(/[⁠​]/g, '').trim()
    if (!line) continue
    const ownerLine = OWNER_LINE_RE.exec(line)
    if (ownerLine) {
      owner = ownerLine[1].trim()
      continue
    }
    if (!BULLET_RE.test(line)) {
      // texto solto dentro do bloco: continuação do item anterior
      const prev = out[out.length - 1]
      if (prev && typeof prev.acao === 'string')
        prev.acao = cleanItem(`${prev.acao || prev.titulo} ${line}`)
      continue
    }
    let text = line.replace(BULLET_RE, '')
    let itemOwner = owner
    // "• Igor: fazer X" só vale como responsável quando o bloco não tem dono (senão é "tarefa: detalhe")
    const inline = owner === null ? INLINE_OWNER_RE.exec(text) : null
    if (inline && !/https?:/.test(inline[1]) && inline[1].trim().split(/\s+/).length <= 4) {
      itemOwner = inline[1].trim()
      text = inline[2]
    }
    text = cleanItem(text)
    if (!text) continue
    const { titulo, acao } = splitTitle(text)
    out.push({
      titulo,
      acao,
      responsavel: itemOwner,
      area: null,
      fase: null,
      prazo: extractDue(text, meetingDate) || null,
      checklist: [],
    })
  }
  return out
}
