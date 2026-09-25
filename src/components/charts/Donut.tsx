export interface DonutSegment {
  key: string
  label: string
  value: number
  /** cor CSS (token `var(--lime)` ou hex) */
  color: string
}

interface Props {
  segments: DonutSegment[]
  /** vira o aria-label do gráfico */
  title: string
  centerValue: string
  centerLabel?: string
  /** largura do SVG em px */
  size?: number
  /** espessura do anel, em unidades do viewBox 0–100 */
  thickness?: number
  legend?: boolean
  className?: string
}

const R = 40

/** Donut em SVG puro: um círculo por fatia com dasharray/dashoffset, começando no topo. */
export function Donut({
  segments,
  title,
  centerValue,
  centerLabel,
  size = 176,
  thickness = 14,
  legend = true,
  className = '',
}: Props) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const circ = 2 * Math.PI * R
  const arcs = segments
    .filter((s) => s.value > 0)
    .reduce<
      { key: string; label: string; value: number; color: string; len: number; offset: number }[]
    >((acc, s) => {
      const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0
      acc.push({ ...s, len: (s.value / total) * circ, offset })
      return acc
    }, [])
  const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const summary = segments.map((s) => `${s.label} ${pctOf(s.value)}% (${s.value})`).join(', ')

  return (
    <div className={`flex flex-wrap items-center gap-5 ${className}`}>
      <svg
        role="img"
        aria-label={`${title}: ${summary}`}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="shrink-0"
      >
        <circle cx={50} cy={50} r={R} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={50}
            cy={50}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.len} ${circ - a.len}`}
            strokeDashoffset={-a.offset}
            transform="rotate(-90 50 50)"
          >
            <title>{`${a.label}: ${a.value} (${pctOf(a.value)}%)`}</title>
          </circle>
        ))}
        <text
          x={50}
          y={centerLabel ? 49 : 52}
          textAnchor="middle"
          className="font-display"
          fontSize={centerValue.length > 3 ? 16 : 20}
          fontWeight={700}
          fill="currentColor"
        >
          {total > 0 ? centerValue : '—'}
        </text>
        {centerLabel ? (
          <text
            x={50}
            y={61}
            textAnchor="middle"
            fontSize={6.5}
            fontWeight={600}
            letterSpacing={0.8}
            fill="var(--muted-foreground)"
          >
            {centerLabel.toUpperCase()}
          </text>
        ) : null}
      </svg>
      {legend ? (
        <ul className="grid min-w-0 flex-1 gap-1.5 text-sm">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate" title={s.label}>
                {s.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {s.value} · {pctOf(s.value)}%
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{s.value}</td>
              <td>{pctOf(s.value)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
