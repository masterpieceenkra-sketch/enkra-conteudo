import { useMemo } from 'react'
import { BRIEF_SECTIONS } from '../data/brief'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../components/ProgressBar'
import { AutoTextarea } from '../components/AutoTextarea'
import { VerifierLinkCard } from '../components/VerifierLinkCard'
import { useLaunchActions, useLaunchState } from '../store/launchStore'

export function BriefPage() {
  const s = useLaunchState()
  const { setBrief } = useLaunchActions()

  const stats = useMemo(() => {
    const per = BRIEF_SECTIONS.map((sec) => {
      const filled = sec.fields.filter((f) => (s.brief[f.id] ?? '').trim() !== '').length
      return { id: sec.id, filled, total: sec.fields.length }
    })
    const filled = per.reduce((a, b) => a + b.filled, 0)
    const total = per.reduce((a, b) => a + b.total, 0)
    return { per, filled, total, pct: total ? Math.round((filled / total) * 100) : 0 }
  }, [s.brief])

  return (
    <>
      <PageHeader kicker="Etapa 1" title="Brief do lançamento">
        Tudo que a equipe precisa saber antes de começar. Preencha no seu ritmo, cada campo é salvo
        na hora.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <p className="label-mono">Preenchimento</p>
            <p className="mt-1 font-display text-3xl">{stats.pct}%</p>
            <ProgressBar value={stats.pct} className="mt-2" label="Preenchimento do brief" />
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.filled} de {stats.total} campos
            </p>
          </div>
          <nav aria-label="Seções do brief" className="mt-3 hidden lg:block">
            <ul className="grid gap-0.5">
              {BRIEF_SECTIONS.map((sec, i) => {
                const st = stats.per[i]
                const complete = st.filled === st.total
                return (
                  <li key={sec.id}>
                    <a
                      href={`#brief-${sec.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <span className="truncate">{sec.title}</span>
                      <span
                        className={`shrink-0 text-xs font-semibold ${complete ? 'text-primary' : ''}`}
                      >
                        {st.filled}/{st.total}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <div className="grid gap-6">
          {BRIEF_SECTIONS.map((sec, i) => {
            const st = stats.per[i]
            return (
              <section
                key={sec.id}
                id={`brief-${sec.id}`}
                className="card scroll-mt-20 p-4 sm:p-6"
                aria-labelledby={`h-${sec.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`h-${sec.id}`} className="text-xl">
                    {sec.title}
                  </h2>
                  <span className="label-mono">
                    {st.filled}/{st.total}
                  </span>
                </div>
                {sec.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{sec.description}</p>
                ) : null}
                <div className="mt-4 grid gap-4 sm:mt-5 sm:grid-cols-2 sm:gap-5">
                  {sec.fields.map((f) => {
                    const long = f.kind === 'long'
                    const inputId = `brief-field-${f.id}`
                    return (
                      <div key={f.id} className={`block ${long ? 'sm:col-span-2' : ''}`}>
                        <label htmlFor={inputId} className="label-mono block">
                          {f.label}
                        </label>
                        {f.hint ? (
                          <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>
                        ) : null}
                        {long ? (
                          <AutoTextarea
                            id={inputId}
                            className="field mt-2"
                            minRows={3}
                            value={s.brief[f.id] ?? ''}
                            onChange={(v) => setBrief(f.id, v)}
                          />
                        ) : (
                          <input
                            id={inputId}
                            type={f.kind === 'number' ? 'number' : 'text'}
                            inputMode={f.kind === 'number' ? 'decimal' : undefined}
                            className="field mt-2"
                            value={s.brief[f.id] ?? ''}
                            onChange={(e) => setBrief(f.id, e.target.value)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                {sec.id === 'whatsapp' ? (
                  <VerifierLinkCard adminNumbers={s.brief.adminNumeros ?? ''} />
                ) : null}
              </section>
            )
          })}
        </div>
      </div>
    </>
  )
}
