export interface BarPoint {
  key: string
  label: string
  /** número que dá o tamanho da barra */
  value: number
  /** texto que aparece no fim da barra (ex.: R$ 1.200,00) */
  display: string
  /** destaque (mês atual, categoria selecionada) */
  highlight?: boolean
}

interface Props {
  points: BarPoint[]
  title: string
  emptyMessage: string
  /** cor das barras; o destaque usa `var(--primary)` */
  color?: string
}

/** Barras horizontais simples, proporcionais ao maior valor. Mesma linguagem do Analytics. */
export function Bars({ points, title, emptyMessage, color = 'var(--blue)' }: Props) {
  const max = points.reduce((m, p) => (p.value > m ? p.value : m), 0)
  if (points.length === 0) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  return (
    <ul className="grid gap-2" aria-label={title}>
      {points.map((p) => (
        <li key={p.key} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          <span className="truncate text-xs text-muted-foreground">{p.label}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 rounded-full"
              style={{
                width: max === 0 ? '2px' : `${Math.max(2, (p.value / max) * 100)}%`,
                background: p.highlight ? 'var(--primary)' : color,
              }}
              aria-hidden
            />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{p.display}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
