/** Utilitários de data em formato ISO `yyyy-mm-dd`, sem fuso (meio-dia local evita DST). */

export type IsoDate = string

export function todayIso(now: Date = new Date()): IsoDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayIso(d)
}

/** Diferença em dias inteiros (b - a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()
  return Math.round(ms / 86_400_000)
}

export function isValidIso(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(`${iso}T12:00:00`).getTime())
}

/** `2026-09-18` → `18/09/2026` */
export function formatBr(iso: IsoDate | undefined | null): string {
  if (!iso || !isValidIso(iso)) return '--/--/----'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** `2026-09-18` → `18 set` */
export function formatShort(iso: IsoDate): string {
  if (!isValidIso(iso)) return '--'
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

/** Frase humana de distância até uma data: "hoje", "amanhã", "faltam 5 dias", "há 3 dias". */
export function relativeLabel(target: IsoDate, today: IsoDate): string {
  const n = diffDays(today, target)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  if (n > 1) return `faltam ${n} dias`
  return `há ${-n} dias`
}
