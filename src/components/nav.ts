import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  NotebookPen,
} from 'lucide-react'

export const NAV = [
  { to: '/', label: 'Painel', short: 'Painel', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', short: 'Dados', icon: BarChart3 },
  { to: '/brief', label: 'Brief', short: 'Brief', icon: FileText },
  { to: '/calendario', label: 'Calendário', short: 'Datas', icon: CalendarDays },
  { to: '/checklist', label: 'Checklist', short: 'Tarefas', icon: ClipboardList },
  { to: '/diario', label: 'Diário de bordo', short: 'Diário', icon: NotebookPen },
] as const
