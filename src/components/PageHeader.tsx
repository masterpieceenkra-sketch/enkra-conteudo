import type { ReactNode } from 'react'

interface Props {
  kicker: string
  title: string
  children?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ kicker, title, children, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-2.5">
          <span className="brand-squares" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="label-mono">{kicker}</span>
        </p>
        <h1 className="mt-1.5 text-[1.75rem] leading-tight sm:mt-2 sm:text-4xl">{title}</h1>
        {children ? (
          <p className="mt-2.5 max-w-2xl text-sm text-muted-foreground sm:mt-3">{children}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
