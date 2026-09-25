/** Linha do campo "Números dos admins": `+55 85 99999-0000 · Nome` (o nome é opcional). */
export interface AdminNumber {
  raw: string
  digits: string
  name: string
}

export function parseAdminNumbers(text: string): AdminNumber[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [num, ...rest] = line.split(/\s[·|-]\s|\s-\s/)
      const digits = num.replace(/\D/g, '')
      return { raw: num.trim(), digits, name: rest.join(' ').trim() }
    })
    .filter((n) => n.digits.length >= 8)
}

/** Formata dígitos brasileiros para leitura: 5585999990000 → +55 (85) 99999-0000 */
export function formatBr(digits: string): string {
  let d = digits
  if (d.length === 10 || d.length === 11) d = `55${d}`
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d)
  if (!m) return `+${d}`
  return `+55 (${m[1]}) ${m[2]}-${m[3]}`
}

export function waLink(digits: string): string {
  const d = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
  return `https://wa.me/${d}`
}
