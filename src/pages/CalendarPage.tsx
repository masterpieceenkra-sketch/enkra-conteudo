import { ArrowDown, ArrowUp, CalendarPlus, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { Timeline } from '../components/Timeline'
import { googleCalendarUrl, milestoneEvent } from '../lib/gcal'
import { useToast } from '../components/toastContext'
import { diffDays, formatBr, isValidIso, todayIso } from '../lib/dates'
import { boardKind, useLaunchActions, useLaunchState } from '../store/launchStore'

export function CalendarPage() {
  const s = useLaunchState()
  const {
    addPhase,
    removePhase,
    movePhase,
    patchPhase,
    patchMilestone,
    addMilestone,
    removeMilestone,
    shiftLaunchStart,
    restoreDefaultDates,
  } = useLaunchActions()
  const toast = useToast()
  const today = todayIso()

  const [pendingStart, setPendingStart] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPhase, setNewPhase] = useState('')
  const [phaseToRemove, setPhaseToRemove] = useState<string | null>(null)
  const isLaunch = boardKind(s) === 'launch'

  const sortedMilestones = useMemo(
    () => [...s.milestones].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
    [s.milestones],
  )

  const delta = pendingStart ? diffDays(s.launchStart, pendingStart) : 0

  return (
    <>
      <PageHeader
        kicker={isLaunch ? 'Etapa 2' : 'Datas'}
        title={isLaunch ? 'Calendário do lançamento' : 'Calendário do quadro'}
      >
        {isLaunch
          ? 'Mude a data de início e todas as fases, marcos e prazos deslocam juntos. Ou ajuste cada data individualmente.'
          : 'Monte as fases do quadro na ordem que fizer sentido. Datas são opcionais: fase sem data não entra na linha do tempo.'}
      </PageHeader>

      {/* Início do lançamento (só em quadro de lançamento) */}
      {isLaunch ? (
        <section className="card p-4 sm:p-6" aria-labelledby="start-title">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h2 id="start-title" className="text-xl">
                Início do lançamento
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hoje o lançamento começa em{' '}
                <strong className="text-foreground">{formatBr(s.launchStart)}</strong>. Ao trocar,
                todas as datas se movem o mesmo número de dias.
              </p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="label-mono">Nova data</span>
              <input
                type="date"
                className="field sm:w-auto"
                value={pendingStart ?? s.launchStart}
                onChange={(e) =>
                  setPendingStart(e.target.value === s.launchStart ? null : e.target.value)
                }
              />
            </label>
          </div>
          {pendingStart && isValidIso(pendingStart) && delta !== 0 ? (
            <div className="fade-in mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-lime/25 px-3 py-2.5 text-sm">
              <span>
                Mover tudo{' '}
                <strong>
                  {Math.abs(delta)} dia{Math.abs(delta) > 1 ? 's' : ''}
                </strong>{' '}
                {delta > 0 ? 'para a frente' : 'para trás'}?
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setPendingStart(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    shiftLaunchStart(pendingStart)
                    setPendingStart(null)
                    toast('Datas deslocadas')
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5 sm:mt-6">
        <Timeline
          state={s}
          today={today}
          defaultExpanded
          hideEditLink
          onPhaseChange={(id, patch) => {
            patchPhase(id, patch)
            toast('Datas da fase atualizadas')
          }}
        />
      </div>

      {/* Fases */}
      <section className="card mt-5 p-4 sm:mt-6 sm:p-6" aria-labelledby="ph-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ph-title" className="text-xl">
            {isLaunch ? 'Datas das fases' : 'Fases do quadro'}
          </h2>
          {isLaunch ? (
            <button type="button" className="btn-ghost" onClick={() => setConfirmRestore(true)}>
              Restaurar padrão
            </button>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4">
          {s.phases.map((p, i) => {
            const invalid = !!p.start && !!p.end && p.end < p.start
            return (
              <div
                key={p.id}
                className="grid gap-3 border-b border-border pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div className="flex items-center gap-1">
                  <input
                    className="field"
                    aria-label="Nome da fase"
                    value={p.name}
                    onChange={(e) => patchPhase(p.id, { name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span className="label-mono">Início</span>
                    <input
                      type="date"
                      className="field sm:w-auto"
                      value={p.start}
                      onChange={(e) => patchPhase(p.id, { start: e.target.value })}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span className="label-mono">Fim</span>
                    <input
                      type="date"
                      className={`field sm:w-auto ${invalid ? 'border-danger' : ''}`}
                      aria-invalid={invalid}
                      value={p.end}
                      onChange={(e) => patchPhase(p.id, { end: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-1 sm:pl-2">
                  <button
                    type="button"
                    className="btn-ghost size-9 justify-center p-0"
                    aria-label={`Subir ${p.name}`}
                    disabled={i === 0}
                    onClick={() => movePhase(p.id, 'up')}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost size-9 justify-center p-0"
                    aria-label={`Descer ${p.name}`}
                    disabled={i === s.phases.length - 1}
                    onClick={() => movePhase(p.id, 'down')}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost size-9 justify-center p-0 text-danger"
                    aria-label={`Apagar ${p.name}`}
                    disabled={s.phases.length <= 1}
                    onClick={() => setPhaseToRemove(p.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newPhase.trim()) return
            addPhase(newPhase)
            setNewPhase('')
            toast('Fase criada')
          }}
        >
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="label-mono">Nova fase</span>
            <input
              className="field"
              placeholder={isLaunch ? 'Ex.: Pós-lançamento' : 'Ex.: Semana 3'}
              maxLength={60}
              value={newPhase}
              onChange={(e) => setNewPhase(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-secondary" disabled={!newPhase.trim()}>
            <Plus className="size-4" aria-hidden /> Criar fase
          </button>
          <p className="w-full text-xs text-muted-foreground">
            Fase sem data fica fora da linha do tempo e do Gantt, e serve para quadro sem
            cronograma.
          </p>
        </form>
      </section>

      {/* Marcos (só em quadro de lançamento) */}
      {isLaunch ? (
        <section className="card mt-5 p-4 sm:mt-6 sm:p-6" aria-labelledby="ms-title">
          <h2 id="ms-title" className="text-xl">
            Marcos principais
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sortedMilestones.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 sm:flex-row sm:items-center"
              >
                <input
                  className="field"
                  aria-label="Nome do marco"
                  value={m.label}
                  onChange={(e) => patchMilestone(m.id, { label: e.target.value })}
                />
                <input
                  type="date"
                  className="field sm:w-auto"
                  aria-label="Data do marco"
                  value={m.date}
                  onChange={(e) => patchMilestone(m.id, { date: e.target.value })}
                />
                <a
                  href={isValidIso(m.date) ? googleCalendarUrl(milestoneEvent(m)) : undefined}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`icon-btn self-end sm:self-auto ${isValidIso(m.date) ? '' : 'pointer-events-none opacity-40'}`}
                  aria-label={`Adicionar ${m.label} ao Google Agenda`}
                  title="Adicionar ao Google Agenda"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                </a>
                <button
                  type="button"
                  className="icon-btn self-end sm:self-auto"
                  aria-label={`Excluir marco ${m.label}`}
                  onClick={() => removeMilestone(m.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <form
            className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newLabel.trim() || !isValidIso(newDate)) return
              addMilestone(newLabel.trim(), newDate)
              setNewLabel('')
              setNewDate('')
              toast('Marco adicionado')
            }}
          >
            <input
              className="field"
              placeholder="Novo marco (ex.: Live de encerramento)"
              aria-label="Nome do novo marco"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <input
              type="date"
              className="field sm:w-auto"
              aria-label="Data do novo marco"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <button
              type="submit"
              className="btn-secondary"
              disabled={!newLabel.trim() || !isValidIso(newDate)}
            >
              <Plus className="size-4" aria-hidden /> Adicionar
            </button>
          </form>
        </section>
      ) : null}

      <ConfirmDialog
        open={phaseToRemove !== null}
        title="Apagar esta fase?"
        description={(() => {
          const p = s.phases.find((x) => x.id === phaseToRemove)
          if (!p) return ''
          const tasks = p.areas.reduce((n, a) => n + a.tasks.length, 0)
          return `"${p.name}" sai do quadro com ${p.areas.length} área(s) e ${tasks} tarefa(s), e as anotações do diário dessa fase também. Não dá para desfazer.`
        })()}
        confirmLabel="Apagar fase"
        onCancel={() => setPhaseToRemove(null)}
        onConfirm={() => {
          if (phaseToRemove) removePhase(phaseToRemove)
          setPhaseToRemove(null)
          toast('Fase apagada')
        }}
      />
      <ConfirmDialog
        open={confirmRestore}
        title="Restaurar datas padrão?"
        description={`Fases e marcos voltam ao modelo original a partir de ${formatBr(s.launchStart)}. Nomes de fase e tarefas não mudam.`}
        confirmLabel="Restaurar"
        onCancel={() => setConfirmRestore(false)}
        onConfirm={() => {
          restoreDefaultDates()
          setConfirmRestore(false)
          toast('Datas restauradas')
        }}
      />
    </>
  )
}
