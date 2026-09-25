import { CalendarPlus, ExternalLink, FileText, Pencil, Plus, Trash2, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Meeting, Person } from '../data/types'
import { isHttpUrl } from '../data/labels'
import { formatBr, isValidIso, relativeLabel } from '../lib/dates'
import { googleCalendarUrl, meetingEvent } from '../lib/gcal'
import {
  SUMMARY_MAX_LENGTH,
  upcomingMeetings,
  useLaunchActions,
  useLaunchState,
} from '../store/launchStore'
import { AutoTextarea } from './AutoTextarea'
import { useConfirm } from './confirmContext'
import { useToast } from './toastContext'
import { TaskProposals } from './TaskProposals'
import { SYNC_ENABLED } from '../lib/supabase'

type Draft = Omit<Meeting, 'id'>
const EMPTY: Draft = {
  title: '',
  date: '',
  time: '',
  durationMin: 60,
  link: '',
  agenda: '',
  summary: '',
  attendeeIds: [],
}

/** Bloco "Próximas reuniões": título, data, hora, link e pauta. */
export function MeetingsPanel({ today }: { today: string }) {
  const s = useLaunchState()
  const { addMeeting, patchMeeting, removeMeeting } = useLaunchActions()
  const confirm = useConfirm()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [summaryOf, setSummaryOf] = useState<string | null>(null)

  const upcoming = upcomingMeetings(s, today)
  const past = s.meetings.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date))
  const list = showPast ? [...upcoming, ...past] : upcoming

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="mt-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mt-title" className="flex items-center gap-2 text-xl">
          <Video className="size-5" aria-hidden /> Próximas reuniões
          {upcoming.length ? (
            <span className="rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
              {upcoming.length}
            </span>
          ) : null}
        </h2>
        {!adding ? (
          <button
            type="button"
            className="btn-secondary h-8 px-2.5 py-0 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5" aria-hidden /> Nova reunião
          </button>
        ) : null}
      </div>

      {adding ? (
        <MeetingForm
          people={s.people}
          initial={EMPTY}
          submitLabel="Salvar reunião"
          onCancel={() => setAdding(false)}
          onSubmit={(d) => {
            if (addMeeting(d)) {
              setAdding(false)
              toast('Reunião adicionada')
            }
          }}
        />
      ) : null}

      {list.length === 0 && !adding ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma reunião marcada. Registre a próxima com data, link e pauta para o time chegar
          preparado.
        </p>
      ) : null}

      <ol className="mt-3 grid gap-2">
        {list.map((m) =>
          editingId === m.id ? (
            <li key={m.id}>
              <MeetingForm
                people={s.people}
                initial={m}
                submitLabel="Salvar"
                onCancel={() => setEditingId(null)}
                onSubmit={(d) => {
                  patchMeeting(m.id, d)
                  setEditingId(null)
                }}
              />
            </li>
          ) : (
            <li
              key={m.id}
              className={`rounded-lg border border-border bg-surface-2 p-3 ${m.date < today ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-secondary py-1 text-secondary-foreground">
                  <span className="font-display text-lg font-bold leading-none">
                    {m.date.slice(8, 10)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase">
                    {new Date(`${m.date}T12:00:00`)
                      .toLocaleDateString('pt-BR', { month: 'short' })
                      .replace('.', '')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{m.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {relativeLabel(m.date, today)}
                    {m.time ? ` · ${m.time}` : ' · dia inteiro'}
                    {m.time ? ` · ${m.durationMin} min` : ''}
                  </p>
                  {m.attendeeIds?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avisar:{' '}
                      {s.people
                        .filter((p) => m.attendeeIds?.includes(p.id))
                        .map((p) => p.name)
                        .join(', ') || '—'}
                    </p>
                  ) : null}
                  {m.agenda.trim() ? (
                    <details className="mt-1.5 text-sm" open={m.date >= today && m === upcoming[0]}>
                      <summary className="cursor-pointer select-none text-xs font-semibold text-primary">
                        Pauta
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap text-foreground/90">{m.agenda}</p>
                    </details>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.link ? (
                      <a
                        href={m.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="btn-primary h-7 px-2.5 py-0 text-xs"
                      >
                        <ExternalLink className="size-3.5" aria-hidden /> Entrar
                      </a>
                    ) : null}
                    <a
                      href={googleCalendarUrl(meetingEvent(m))}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-ghost h-7 px-2.5 py-0 text-xs"
                      title="Abre o Google Agenda com a reunião preenchida"
                    >
                      <CalendarPlus className="size-3.5" aria-hidden /> Google Agenda
                    </a>
                    {m.summary?.trim() ? (
                      <button
                        type="button"
                        className="btn-secondary h-7 px-2.5 py-0 text-xs"
                        onClick={() => setSummaryOf(m.id)}
                      >
                        <FileText className="size-3.5" aria-hidden /> Ver resumo da reunião
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Editar reunião ${m.title}`}
                    onClick={() => setEditingId(m.id)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn hover:text-danger"
                    aria-label={`Excluir reunião ${m.title}`}
                    onClick={() =>
                      confirm({
                        title: 'Excluir esta reunião?',
                        description: `"${m.title}" em ${formatBr(m.date)} será removida.`,
                        confirmLabel: 'Excluir',
                        danger: true,
                        onConfirm: () => removeMeeting(m.id),
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ol>

      {past.length ? (
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
          onClick={() => setShowPast((v) => !v)}
        >
          {showPast ? 'Ocultar passadas' : `Mostrar passadas (${past.length})`}
        </button>
      ) : null}

      <SummaryDialog
        meeting={s.meetings.find((m) => m.id === summaryOf) ?? null}
        today={today}
        onClose={() => setSummaryOf(null)}
      />
    </section>
  )
}

/** Resumo da reunião em tela cheia (modal), com o texto como foi colado. */
function SummaryDialog({
  meeting,
  today,
  onClose,
}: {
  meeting: Meeting | null
  today: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = !!meeting?.summary
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl"
    >
      {meeting ? (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="label-mono">Resumo da reunião</p>
              <h3 className="mt-0.5 text-lg leading-snug">{meeting.title}</h3>
              <p className="text-xs text-muted-foreground">
                {formatBr(meeting.date)}
                {meeting.time ? ` · ${meeting.time}` : ''}
              </p>
            </div>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4 sm:px-6">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{meeting.summary}</p>
            {SYNC_ENABLED ? (
              <div className="mt-5 border-t border-border pt-4">
                <TaskProposals key={meeting.id} meeting={meeting} today={today} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

function MeetingForm({
  people,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  people: Person[]
  initial: Draft
  submitLabel: string
  onSubmit: (d: Draft) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const linkInvalid = d.link.trim() !== '' && !isHttpUrl(d.link.trim())
  const valid = d.title.trim() !== '' && isValidIso(d.date) && !linkInvalid

  return (
    <form
      className="fade-in mt-3 grid gap-3 rounded-lg border border-dashed border-border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(d)
      }}
    >
      <input
        autoFocus
        className="field"
        placeholder="Título (ex.: Call de concepção com o cliente)"
        aria-label="Título da reunião"
        value={d.title}
        onChange={(e) => set('title', e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_1fr]">
        <label className="flex flex-col gap-1">
          <span className="label-mono">Data</span>
          <input
            type="date"
            className="field"
            value={d.date}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono">Hora</span>
          <input
            type="time"
            className="field"
            value={d.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <span className="label-mono">Duração (min)</span>
          <input
            type="number"
            min={5}
            max={1440}
            step={5}
            className="field"
            value={d.durationMin}
            onChange={(e) => set('durationMin', Number(e.target.value) || 60)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label-mono">Link da chamada</span>
        <input
          type="url"
          inputMode="url"
          className={`field ${linkInvalid ? 'border-danger' : ''}`}
          placeholder="https://meet.google.com/..."
          aria-invalid={linkInvalid}
          value={d.link}
          onChange={(e) => set('link', e.target.value)}
        />
        {linkInvalid ? (
          <span className="text-xs text-danger">
            Use um endereço começando com http:// ou https://
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-mono">Pauta</span>
        <AutoTextarea
          className="field"
          minRows={3}
          placeholder="Tópicos da reunião, decisões esperadas, quem apresenta o quê"
          value={d.agenda}
          onChange={(v) => set('agenda', v)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label-mono">Resumo da reunião</span>
        <AutoTextarea
          className="field"
          minRows={3}
          placeholder="Depois da reunião, cole aqui a ata ou o resumo (ex.: o do Tactiq). Só quem abrir o painel vê, ninguém recebe aviso."
          value={d.summary ?? ''}
          onChange={(v) => set('summary', v.slice(0, SUMMARY_MAX_LENGTH))}
        />
      </label>
      {people.length ? (
        <fieldset className="grid gap-1.5">
          <legend className="label-mono mb-1">Avisar no WhatsApp</legend>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = d.attendeeIds?.includes(p.id) ?? false
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip ${on ? 'chip-active' : ''}`}
                  aria-pressed={on}
                  title={p.phone ? undefined : 'Sem WhatsApp cadastrado'}
                  onClick={() =>
                    set(
                      'attendeeIds',
                      on
                        ? (d.attendeeIds ?? []).filter((x) => x !== p.id)
                        : [...(d.attendeeIds ?? []), p.id],
                    )
                  }
                >
                  {p.name}
                </button>
              )
            })}
            <button
              type="button"
              className="chip"
              onClick={() =>
                set(
                  'attendeeIds',
                  people.map((p) => p.id),
                )
              }
            >
              todos
            </button>
          </div>
        </fieldset>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={!valid}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
