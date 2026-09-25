import { PageHeader } from '../components/PageHeader'
import { AutoTextarea } from '../components/AutoTextarea'
import { formatBr, todayIso } from '../lib/dates'
import { currentPhase, useLaunchActions, useLaunchState } from '../store/launchStore'

export function DiaryPage() {
  const s = useLaunchState()
  const { setDiary } = useLaunchActions()
  const today = todayIso()
  const current = currentPhase(s, today)
  const filled = Object.values(s.diary).filter((v) => v.trim()).length

  return (
    <>
      <PageHeader
        kicker="Etapa 4"
        title="Diário de bordo"
        actions={
          current ? (
            <a href={`#diario-${current.id}`} className="btn-ghost">
              Ir para a fase atual
            </a>
          ) : null
        }
      >
        Anote o que aconteceu em cada área, dia a dia. É esse registro que faz o debriefing valer a
        pena.
        {filled > 0 ? ` ${filled} registro${filled > 1 ? 's' : ''} até agora.` : ''}
      </PageHeader>

      <div className="grid gap-6">
        {s.phases.map((p) => {
          const active = p.id === current?.id && s.launchStart <= today
          return (
            <section
              key={p.id}
              id={`diario-${p.id}`}
              className={`card scroll-mt-20 p-4 sm:p-6 ${active ? 'border-primary/60' : ''}`}
              aria-labelledby={`d-${p.id}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`d-${p.id}`} className="flex items-center gap-2 text-xl">
                  {p.name}
                  {active ? (
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      agora
                    </span>
                  ) : null}
                </h2>
                <span className="label-mono">
                  {formatBr(p.start)} — {formatBr(p.end)}
                </span>
              </div>
              {p.areas.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Esta fase não tem áreas. Adicione no checklist.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {p.areas.map((a) => {
                    const key = `${p.id}:${a.name}`
                    const id = `diary-${p.id}-${a.id}`
                    const value = s.diary[key] ?? ''
                    return (
                      <div key={a.id}>
                        <label htmlFor={id} className="label-mono block">
                          {a.name}
                        </label>
                        <AutoTextarea
                          id={id}
                          minRows={3}
                          placeholder="O que aconteceu, o que travou, o que aprendeu"
                          className="field mt-2"
                          value={value}
                          onChange={(v) => setDiary(key, v)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
