interface Props {
  value: number
  className?: string
  /** altura em classes tailwind, ex. h-2 */
  size?: 'sm' | 'md'
  tone?: 'primary' | 'lime' | 'secondary'
  label?: string
}

export function ProgressBar({
  value,
  className = '',
  size = 'sm',
  tone = 'primary',
  label,
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const h = size === 'sm' ? 'h-2' : 'h-3'
  const bg = tone === 'lime' ? 'bg-lime' : tone === 'secondary' ? 'bg-secondary' : 'bg-primary'
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={`${h} w-full overflow-hidden rounded-full bg-muted ${className}`}
    >
      <div
        className={`h-full rounded-full ${bg} transition-[width] duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
