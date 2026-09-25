import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Columns3,
  Compass,
  GanttChart,
  Grid3x3,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  short: string
  icon: LucideIcon
  /** some da navegação do cliente (tela de trabalho do time) */
  teamOnly?: boolean
  /** no celular fica no menu ⋮, para a barra de baixo caber */
  mobileMore?: boolean
}

/** Navegação do hub de conteúdo, na ordem do fluxo de trabalho. */
export const CONTENT_NAV: NavItem[] = [
  { to: '/', label: 'Analytics', short: 'Analytics', icon: BarChart3, teamOnly: true },
  { to: '/quadro', label: 'Quadro', short: 'Quadro', icon: Columns3 },
  { to: '/calendario', label: 'Calendário', short: 'Datas', icon: CalendarDays },
  { to: '/cronograma', label: 'Cronograma', short: 'Gantt', icon: GanttChart, mobileMore: true },
  { to: '/feed', label: 'Feed', short: 'Feed', icon: Grid3x3, mobileMore: true },
  { to: '/aprovar', label: 'Aprovar', short: 'Aprovar', icon: BadgeCheck },
  { to: '/estrategia', label: 'Estratégia', short: 'Estratégia', icon: Compass },
]

/** O cliente abre na fila de aprovação; o resto vem depois, na mesma ordem. */
export function navFor(client: boolean): NavItem[] {
  const visible = CONTENT_NAV.filter((n) => !client || !n.teamOnly)
  if (!client) return visible
  const first = visible.filter((n) => n.to === '/aprovar')
  return [...first, ...visible.filter((n) => n.to !== '/aprovar')]
}
