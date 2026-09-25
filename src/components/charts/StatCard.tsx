import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

interface Props {
  label: string
  value: string | number
  hint?: string
  /** rota do checklist para abrir a lista correspondente */
  to?: string
  tone?: 'default' | 'hero' | 'danger'
}

/** Número grande com rótulo, no padrão dos cards do Painel; vira link quando `to` é informado. */
export function StatCard({ label, value, hint, to, tone = 'default' }: Props) {
  const hero = tone === 'hero'
  const danger = tone === 'danger' && Number(value) > 0
  const cls = `card group relative block p-4 transition-colors sm:p-6 ${
    hero ? 'bg-secondary text-secondary-foreground' : ''
  } ${danger ? 'border-danger/50' : ''} ${to ? 'hover:border-primary' : ''}`
  const body = (
    <>
      <p className={`label-mono ${hero ? 'text-secondary-foreground/60' : ''}`}>{label}</p>
      <p
        className={`mt-1 font-display text-4xl tabular-nums sm:mt-2 sm:text-5xl ${danger ? 'text-danger' : ''}`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`mt-2 text-sm ${hero ? 'opacity-70' : 'text-muted-foreground'}`}>{hint}</p>
      ) : null}
      {to ? (
        <ArrowUpRight
          className="absolute right-4 top-4 size-4 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </>
  )
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
