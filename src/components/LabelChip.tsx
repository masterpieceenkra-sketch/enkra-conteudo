import { LABEL_COLOR_CLASS } from '../data/labels'
import type { Label } from '../data/types'

interface Props {
  label: Label
  size?: 'sm' | 'md'
  active?: boolean
  onClick?: () => void
  title?: string
}

/** Chip de etiqueta na cor da marca. Vira botão quando recebe onClick. */
export function LabelChip({ label, size = 'sm', active, onClick, title }: Props) {
  const cls = `${LABEL_COLOR_CLASS[label.color]} ${
    size === 'sm' ? 'h-5 px-2 text-[10px]' : 'h-7 px-2.5 text-xs'
  } inline-flex max-w-full items-center rounded-md font-bold uppercase tracking-wider whitespace-nowrap ${
    onClick ? 'transition-opacity hover:opacity-85' : ''
  } ${active === false ? 'opacity-40' : ''}`
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active} title={title}>
        <span className="truncate">{label.name}</span>
      </button>
    )
  return (
    <span className={cls} title={title}>
      <span className="truncate">{label.name}</span>
    </span>
  )
}
