import type { Label, LabelColor } from './types'

/** Etiquetas iniciais; o usuário pode renomear, recolorir, excluir e criar outras. */
export const DEFAULT_LABELS: Label[] = [
  { id: 'l-urgente', name: 'Urgente', color: 'pink' },
  { id: 'l-bloqueado', name: 'Bloqueado', color: 'black' },
  { id: 'l-aguardando', name: 'Aguardando terceiro', color: 'aqua' },
  { id: 'l-revisao', name: 'Em revisão', color: 'blue' },
  { id: 'l-rapido', name: 'Rápido', color: 'lime' },
]

export const LABEL_COLOR_NAMES: Record<LabelColor, string> = {
  pink: 'Pink',
  blue: 'Azul',
  aqua: 'Verde-água',
  lime: 'Lima',
  black: 'Preto',
  gray: 'Cinza',
}

/** Classes Tailwind (tokens da marca) para o chip de cada cor. */
export const LABEL_COLOR_CLASS: Record<LabelColor, string> = {
  pink: 'bg-primary text-primary-foreground',
  blue: 'bg-blue text-blue-foreground',
  aqua: 'bg-aqua text-aqua-foreground',
  lime: 'bg-lime text-lime-foreground',
  black: 'bg-secondary text-secondary-foreground',
  gray: 'bg-muted text-foreground',
}

export function isLabelColor(v: unknown): v is LabelColor {
  return typeof v === 'string' && v in LABEL_COLOR_CLASS
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
