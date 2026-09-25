import type { DistributionKey } from '../../store/analytics'

/** Cores fixas de estado, iguais no donut e nas barras; tokens que mudam com o tema. */
export const STATUS_COLORS: Record<DistributionKey, string> = {
  done: 'var(--lime)',
  pending: 'var(--blue)',
  late: 'var(--danger)',
}
