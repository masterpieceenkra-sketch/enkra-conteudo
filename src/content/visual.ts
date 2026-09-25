import {
  Clapperboard,
  Film,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { LabelColor } from '../data/types'
import type { ApprovalState, ContentFormat, Network } from './model'

export const FORMAT_ICON: Record<ContentFormat, LucideIcon> = {
  reels: Clapperboard,
  carrossel: GalleryHorizontalEnd,
  estatico: ImageIcon,
  stories: Smartphone,
  video: Film,
  outro: Sparkles,
}

export const NETWORK_SHORT: Record<Network, string> = {
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  linkedin: 'IN',
  facebook: 'FB',
  threads: 'TH',
}

/** Cor sólida da paleta (barra da campanha, bolinha da coluna). */
export const SOLID: Record<LabelColor, string> = {
  pink: 'bg-primary',
  blue: 'bg-blue',
  aqua: 'bg-aqua',
  lime: 'bg-lime',
  black: 'bg-secondary',
  gray: 'bg-muted-foreground/50',
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export const APPROVAL_INFO: Record<ApprovalState, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando cliente', cls: 'bg-blue-soft text-foreground' },
  aprovado: { label: 'Aprovado', cls: 'bg-lime-soft text-foreground' },
  ajuste: { label: 'Ajuste pedido', cls: 'bg-pink-soft text-foreground' },
}

/** Texto legível sobre a cor sólida. */
export const ON_SOLID: Record<LabelColor, string> = {
  pink: 'text-primary-foreground',
  blue: 'text-blue-foreground',
  aqua: 'text-aqua-foreground',
  lime: 'text-lime-foreground',
  black: 'text-secondary-foreground',
  gray: 'text-foreground',
}

/** Fundo suave da cor (prévia sem capa na grade do feed): mostra o ritmo sem pesar. */
export const SOFT: Record<LabelColor, string> = {
  pink: 'bg-pink-soft',
  blue: 'bg-blue-soft',
  aqua: 'bg-aqua/20',
  lime: 'bg-lime-soft',
  black: 'bg-muted',
  gray: 'bg-surface-2',
}
