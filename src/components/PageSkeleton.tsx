/** Esqueleto exibido enquanto o chunk de uma rota carrega (nunca um spinner genérico). */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="fade-in">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-3 h-9 w-2/3 max-w-md rounded bg-muted" />
      <div className="mt-3 h-4 w-1/2 max-w-sm rounded bg-muted" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-32 rounded-xl bg-muted" />
      </div>
      <div className="mt-5 h-48 rounded-xl bg-muted" />
    </div>
  )
}
