/**
 * Gráficos do Analytics de conteúdo, desenhados à mão (SVG e divs), no mesmo espírito de
 * `components/charts`: tokens de cor do tema, rótulos legíveis e tabela escondida para leitor
 * de tela com os mesmos números.
 */

export interface ColumnPoint {
  key: string
  label: string
  /** parte principal (ex.: publicado) */
  value: number
  /** parte de cima, mais clara (ex.: planejado que ainda não saiu) */
  extra?: number
  /** meta do período: vira um traço sobre a barra */
  goal?: number
  active?: boolean
}

/**
 * Colunas verticais por período. A barra cheia é `value`; `extra` empilha em tom claro; `goal`
 * desenha o traço da meta. O período selecionado fica destacado.
 */
export function ColumnChart({
  points,
  title,
  color,
  extraLabel,
  valueLabel,
  height = 168,
}: {
  points: ColumnPoint[]
  title: string
  color: string
  valueLabel: string
  extraLabel?: string
  height?: number
}) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.value + (p.extra ?? 0), p.goal ?? 0)))
  const hasGoal = points.some((p) => (p.goal ?? 0) > 0)
  return (
    <div>
      <div
        className="relative flex items-end gap-1.5 border-b border-border pt-5 sm:gap-2.5"
        style={{ height }}
        role="img"
        aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(', ')}`}
      >
        {points.map((p) => {
          // tudo em % da maior coluna do gráfico: publicado embaixo, planejado empilhado, meta em traço
          const pc = (v: number) => `${(v / max) * 100}%`
          const top = p.value + (p.extra ?? 0)
          return (
            <div key={p.key} className="group relative h-full flex-1">
              {p.extra ? (
                <span
                  className="absolute inset-x-0 rounded-t-md opacity-30"
                  style={{ bottom: pc(p.value), height: pc(p.extra), background: color }}
                  title={`${extraLabel ?? ''}: ${p.extra}`}
                />
              ) : null}
              <span
                className={`absolute inset-x-0 bottom-0 transition-[filter,height] duration-500 group-hover:brightness-110 ${
                  p.extra ? '' : 'rounded-t-md'
                }`}
                style={{
                  height: pc(p.value),
                  minHeight: p.value ? 3 : 0,
                  background: color,
                  opacity: p.active ? 1 : 0.75,
                }}
                title={`${valueLabel}: ${p.value}`}
              />
              {p.goal ? (
                <span
                  className="absolute -inset-x-1 z-10 border-t-2 border-dashed border-foreground/70"
                  style={{ bottom: pc(p.goal) }}
                  title={`Meta: ${p.goal}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`absolute inset-x-0 text-center text-[11px] font-bold tabular-nums transition-opacity ${
                  p.active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                style={{ bottom: `calc(${pc(Math.max(top, p.goal ?? 0))} + 4px)` }}
              >
                {p.value}
                {p.goal ? (
                  <span className="font-medium text-muted-foreground">/{p.goal}</span>
                ) : null}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2.5">
        {points.map((p) => (
          <span
            key={p.key}
            className={`flex-1 truncate text-center text-[10px] tabular-nums ${
              p.active ? 'font-bold text-foreground' : 'text-muted-foreground'
            }`}
          >
            {p.label}
          </span>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
          {valueLabel}
        </li>
        {extraLabel ? (
          <li className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm opacity-35"
              style={{ background: color }}
              aria-hidden
            />
            {extraLabel}
          </li>
        ) : null}
        {hasGoal ? (
          <li className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-foreground/70" aria-hidden />
            Meta
          </li>
        ) : null}
      </ul>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{p.value}</td>
              {p.extra !== undefined ? <td>{p.extra}</td> : null}
              {p.goal !== undefined ? <td>{p.goal}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Anel de progresso da meta: arco da porcentagem publicada, número grande no centro. */
export function GoalRing({
  pct,
  size = 168,
  caption = true,
}: {
  pct: number
  size?: number
  /** "DA META" embaixo do número; some no anel pequeno */
  caption?: boolean
}) {
  const r = 42
  const circ = 2 * Math.PI * r
  const shown = Math.min(100, pct)
  const done = pct >= 100
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${pct}% da meta publicada`}
      className="shrink-0"
    >
      <circle cx={50} cy={50} r={r} fill="none" stroke="var(--muted)" strokeWidth={9} />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={done ? 'var(--lime)' : 'var(--primary)'}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${(shown / 100) * circ} ${circ}`}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.2, 0, 0, 1)' }}
      />
      <text
        x={50}
        y={caption ? 52 : 51}
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-display"
        fontSize={caption ? (pct >= 100 ? 21 : 24) : pct >= 100 ? 26 : 30}
        fontWeight={800}
        letterSpacing={-1}
        fill="currentColor"
      >
        {pct}%
      </text>
      {caption ? (
        <text
          x={50}
          y={67}
          textAnchor="middle"
          fontSize={6}
          fontWeight={700}
          letterSpacing={0.8}
          fill="var(--muted-foreground)"
        >
          DA META
        </text>
      ) : null}
    </svg>
  )
}

/** Barra horizontal de progresso com a parte planejada em tom claro atrás. */
export function ProgressRow({
  label,
  value,
  ghost,
  goal,
}: {
  label: string
  value: number
  ghost: number
  goal: number
}) {
  const base = Math.max(goal, value, ghost, 1)
  const done = goal > 0 && value >= goal
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums">
          <span className="font-bold">{value}</span>
          <span className="text-muted-foreground">/{goal || '—'}</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/15"
          style={{ width: `${(ghost / base) * 100}%` }}
          title={`Planejado: ${ghost}`}
        />
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${done ? 'bg-lime' : 'bg-primary'}`}
          style={{ width: `${(value / base) * 100}%` }}
        />
      </div>
    </li>
  )
}
