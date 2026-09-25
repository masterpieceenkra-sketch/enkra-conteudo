import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AutoTextarea } from '../../components/AutoTextarea'
import { useConfirm } from '../../components/confirmContext'
import { addDays, formatShort, todayIso } from '../../lib/dates'
import { newId, useLaunchState } from '../../store/launchStore'
import { pillarMix, weekCadence } from '../cadence'
import { mondayOf } from '../calendar'
import {
  FORMATS,
  FORMAT_LABEL,
  FUNNEL_LABEL,
  type CadenceGoal,
  type FunnelStage,
  type Pillar,
  type Series,
  type Strategy,
  type StrategyItem,
} from '../model'
import { useIsClient } from '../roles'
import { contentOf, useContentActions } from '../useContent'

const STAGES: FunnelStage[] = ['topo', 'meio', 'fundo']
const STAGE_TONE: Record<FunnelStage, string> = {
  topo: 'bg-aqua text-aqua-foreground',
  meio: 'bg-blue text-blue-foreground',
  fundo: 'bg-primary text-primary-foreground',
}
const SECTIONS = [
  ['quem-e', 'Quem é'],
  ['pilares', 'Pilares'],
  ['formatos', 'Formatos'],
  ['series', 'Séries'],
  ['cadencia', 'Cadência'],
  ['fixados', 'Fixados'],
] as const

/**
 * Linha editorial do cliente, no formato do guia que a social media entrega: quem é, pilares
 * de funil, formatos, séries, cadência e fixados. Pilar e série viram campos do card; a
 * cadência vira meta no calendário. O cliente lê; o time edita no lugar.
 */
export function StrategyPage() {
  const s = useLaunchState()
  const st = contentOf(s).strategy
  const client = useIsClient()
  const { updateStrategy } = useContentActions()
  const edit = !client
  const set = (patch: Partial<Strategy>, section: string) => updateStrategy(patch, section)

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <nav aria-label="Seções" className="hidden lg:block">
        <ul className="sticky top-24 flex flex-col gap-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block rounded-md px-2.5 py-1.5 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-12">
        <header>
          <p className="label-mono flex items-center gap-2">
            <span className="brand-squares" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Linha editorial
          </p>
          <h1 className="mt-2 text-3xl sm:text-5xl">Estratégia</h1>
          <Text
            value={st.summary}
            edit={edit}
            onChange={(v) => set({ summary: v }, 'Posicionamento')}
            placeholder="Posicionamento em poucas linhas: para quem é, o que o perfil defende, o que ninguém mais faz igual."
            className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground"
            minRows={2}
          />
        </header>

        <PersonaSection st={st} edit={edit} set={set} />
        <PillarsSection st={st} edit={edit} set={set} />
        <ItemsSection
          id="formatos"
          kicker="Produção"
          title="Formatos"
          intro="Os formatos da casa, com o jeito de fazer cada um. Viram a referência na hora de escrever o card."
          items={st.formats}
          edit={edit}
          onChange={(formats) => set({ formats }, 'Formatos')}
          titlePh="Ex.: Tapa na cara"
          textPh="Como é, quando usar, referência"
        />
        <SeriesSection st={st} edit={edit} set={set} />
        <CadenceSection st={st} edit={edit} set={set} />
        <ItemsSection
          id="fixados"
          kicker="Perfil"
          title="Fixados"
          intro="Os posts que ficam no topo do perfil: o cartão de visitas de quem chega."
          items={st.pinned}
          edit={edit}
          max={6}
          onChange={(pinned) => set({ pinned }, 'Fixados')}
          titlePh="Ex.: Descoberta: quem é a marca"
          textPh="O que o post precisa mostrar"
        />
      </div>
    </div>
  )
}

type SetFn = (patch: Partial<Strategy>, section: string) => void

function Section({
  id,
  kicker,
  title,
  intro,
  children,
}: {
  id: string
  kicker: string
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="label-mono">{kicker}</p>
      <h2 className="mt-1 text-2xl uppercase sm:text-3xl">{title}</h2>
      {intro ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** Texto que o time edita no lugar e o cliente só lê. */
function Text({
  value,
  edit,
  onChange,
  placeholder,
  className = '',
  minRows = 1,
  label,
}: {
  value: string
  edit: boolean
  onChange: (v: string) => void
  placeholder: string
  className?: string
  minRows?: number
  label?: string
}) {
  if (!edit) return value ? <p className={`whitespace-pre-wrap ${className}`}>{value}</p> : null
  return (
    <AutoTextarea
      value={value}
      onChange={onChange}
      minRows={minRows}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      className={`w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 -mx-1.5 outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-primary focus:bg-surface ${className}`}
    />
  )
}

function Line({
  value,
  edit,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  edit: boolean
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  if (!edit) return <p className={className}>{value}</p>
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={120}
      className={`w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 -mx-1.5 outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-primary focus:bg-surface ${className}`}
    />
  )
}

function RemoveButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const confirm = useConfirm()
  return (
    <button
      type="button"
      className="icon-btn size-7 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-danger"
      aria-label={`Remover ${label}`}
      onClick={() =>
        confirm({
          title: `Remover ${label || 'este item'}?`,
          confirmLabel: 'Remover',
          danger: true,
          onConfirm,
        })
      }
    >
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  )
}

function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full min-h-16 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
    >
      <Plus className="size-4" aria-hidden /> {children}
    </button>
  )
}

function PersonaSection({ st, edit, set }: { st: Strategy; edit: boolean; set: SetFn }) {
  const groups = [...new Set(['Negócio', 'Pessoal', 'Estilo', ...st.persona.map((p) => p.group)])]
    .filter((g) => g.trim())
    .filter((g) => edit || st.persona.some((p) => p.group === g))
  const patch = (id: string, v: Partial<StrategyItem & { group: string }>) =>
    set({ persona: st.persona.map((p) => (p.id === id ? { ...p, ...v } : p)) }, 'Quem é')
  if (!edit && st.persona.length === 0 && !st.personaNote) return null
  return (
    <Section
      id="quem-e"
      kicker="Fundação"
      title="Quem é"
      intro="A matéria-prima de todo conteúdo. Tudo que o time produz precisa soar como alguma destas camadas."
    >
      <div className="flex flex-col gap-6">
        {groups.map((g) => {
          const items = st.persona.filter((p) => p.group === g)
          return (
            <div key={g}>
              <p className="label-mono mb-2">{g}</p>
              <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <li key={p.id} className="group card flex flex-col gap-1 p-4">
                    <div className="flex items-start gap-1">
                      <Line
                        value={p.title}
                        edit={edit}
                        onChange={(v) => patch(p.id, { title: v })}
                        placeholder="Título (ex.: Vendas)"
                        className="font-display text-lg font-bold"
                      />
                      {edit ? (
                        <RemoveButton
                          label={p.title}
                          onConfirm={() =>
                            set({ persona: st.persona.filter((x) => x.id !== p.id) }, 'Quem é')
                          }
                        />
                      ) : null}
                    </div>
                    <Text
                      value={p.text}
                      edit={edit}
                      onChange={(v) => patch(p.id, { text: v })}
                      placeholder="Uma linha sobre essa camada"
                      className="text-sm text-muted-foreground"
                    />
                  </li>
                ))}
                {edit ? (
                  <li>
                    <AddButton
                      onClick={() =>
                        set(
                          {
                            persona: [
                              ...st.persona,
                              { id: newId('ps'), group: g, title: '', text: '' },
                            ],
                          },
                          'Quem é',
                        )
                      }
                    >
                      {g}
                    </AddButton>
                  </li>
                ) : null}
              </ul>
            </div>
          )
        })}
        <div className="rounded-xl border-l-4 border-primary bg-surface-2 px-4 py-3">
          <p className="label-mono mb-1">Nota de contexto</p>
          <Text
            value={st.personaNote}
            edit={edit}
            onChange={(v) => set({ personaNote: v }, 'Quem é')}
            placeholder="De onde vem, onde mora, o que entra como valor e o que não vira tema de feed."
            className="text-sm"
            minRows={2}
          />
        </div>
      </div>
    </Section>
  )
}

function PillarsSection({ st, edit, set }: { st: Strategy; edit: boolean; set: SetFn }) {
  const s = useLaunchState()
  const today = todayIso()
  const from = addDays(today, -27)
  const mix = pillarMix(contentOf(s), from, today)
  const patch = (id: string, v: Partial<Pillar>) =>
    set({ pillars: st.pillars.map((p) => (p.id === id ? { ...p, ...v } : p)) }, 'Pilares')
  const totalMix = mix.reduce((a, m) => a + m.count, 0)
  return (
    <Section
      id="pilares"
      kicker="Estratégia"
      title="Pilares de conteúdo"
      intro="Todo conteúdo nasce sabendo a função dele no funil. O pilar vira um campo no card, e o mix real aparece aqui."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {STAGES.map((stage) => (
          <div key={stage} className="flex flex-col gap-3">
            <p
              className={`inline-flex self-start rounded-md px-2 py-1 font-display text-xs font-bold uppercase tracking-[0.12em] ${STAGE_TONE[stage]}`}
            >
              {FUNNEL_LABEL[stage]}
            </p>
            {st.pillars
              .filter((p) => p.stage === stage)
              .map((p) => {
                const m = mix.find((x) => x.pillarId === p.id)
                return (
                  <article key={p.id} className="group card flex flex-col gap-2 p-4">
                    <div className="flex items-start gap-1">
                      <Line
                        value={p.name}
                        edit={edit}
                        onChange={(v) => patch(p.id, { name: v })}
                        placeholder="Nome do pilar"
                        className="font-display text-xl font-bold"
                      />
                      {edit ? (
                        <RemoveButton
                          label={p.name}
                          onConfirm={() =>
                            set({ pillars: st.pillars.filter((x) => x.id !== p.id) }, 'Pilares')
                          }
                        />
                      ) : null}
                    </div>
                    <Text
                      value={p.goal}
                      edit={edit}
                      onChange={(v) => patch(p.id, { goal: v })}
                      placeholder="Objetivo (ex.: furar a bolha)"
                      className="text-sm font-semibold text-muted-foreground"
                    />
                    {edit ? (
                      <Text
                        value={p.ideas}
                        edit
                        onChange={(v) => patch(p.id, { ideas: v })}
                        placeholder={'Pautas e formatos, um por linha\nEx.: Lo-fi de mentalidade'}
                        className="text-sm"
                        minRows={3}
                        label="Pautas do pilar"
                      />
                    ) : p.ideas ? (
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {p.ideas
                          .split('\n')
                          .filter((l) => l.trim())
                          .map((l, i) => (
                            <li key={i} className="flex gap-2">
                              <span
                                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                                aria-hidden
                              />
                              {l}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                    {m && totalMix ? (
                      <div className="mt-1 border-t border-border pt-2">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-muted-foreground">Últimas 4 semanas</span>
                          <span className="font-bold tabular-nums">
                            {m.count} {m.count === 1 ? 'post' : 'posts'} · {m.pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${STAGE_TONE[stage].split(' ')[0]}`}
                            style={{ width: `${m.pct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            {edit ? (
              <AddButton
                onClick={() =>
                  set(
                    {
                      pillars: [
                        ...st.pillars,
                        { id: newId('pl'), stage, name: '', goal: '', ideas: '' },
                      ],
                    },
                    'Pilares',
                  )
                }
              >
                Pilar de {stage}
              </AddButton>
            ) : null}
          </div>
        ))}
      </div>
      {!totalMix ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Escolha o pilar nos cards e o mix real das últimas 4 semanas aparece em cada pilar.
        </p>
      ) : null}
    </Section>
  )
}

function ItemsSection({
  id,
  kicker,
  title,
  intro,
  items,
  edit,
  onChange,
  titlePh,
  textPh,
  max = 60,
}: {
  id: string
  kicker: string
  title: string
  intro: string
  items: StrategyItem[]
  edit: boolean
  onChange: (items: StrategyItem[]) => void
  titlePh: string
  textPh: string
  max?: number
}) {
  if (!edit && items.length === 0) return null
  const patch = (itemId: string, v: Partial<StrategyItem>) =>
    onChange(items.map((x) => (x.id === itemId ? { ...x, ...v } : x)))
  return (
    <Section id={id} kicker={kicker} title={title} intro={intro}>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it, i) => (
          <li key={it.id} className="group card flex flex-col gap-1.5 p-4">
            <div className="flex items-start gap-2">
              <span className="mt-1 font-mono text-xs font-bold text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Line
                value={it.title}
                edit={edit}
                onChange={(v) => patch(it.id, { title: v })}
                placeholder={titlePh}
                className="font-display text-lg font-bold"
              />
              {edit ? (
                <RemoveButton
                  label={it.title}
                  onConfirm={() => onChange(items.filter((x) => x.id !== it.id))}
                />
              ) : null}
            </div>
            <Text
              value={it.text}
              edit={edit}
              onChange={(v) => patch(it.id, { text: v })}
              placeholder={textPh}
              className="text-sm text-muted-foreground"
              minRows={2}
            />
          </li>
        ))}
        {edit && items.length < max ? (
          <li>
            <AddButton
              onClick={() => onChange([...items, { id: newId('it'), title: '', text: '' }])}
            >
              Adicionar
            </AddButton>
          </li>
        ) : null}
      </ul>
    </Section>
  )
}

function SeriesSection({ st, edit, set }: { st: Strategy; edit: boolean; set: SetFn }) {
  if (!edit && st.series.length === 0) return null
  const patch = (id: string, v: Partial<Series>) =>
    set({ series: st.series.map((x) => (x.id === id ? { ...x, ...v } : x)) }, 'Séries')
  return (
    <Section
      id="series"
      kicker="Formatos de feed"
      title="Séries e quadros fixos"
      intro="Narrativas contínuas: a pessoa volta para ver o próximo episódio. A série vira um campo no card."
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {st.series.map((x) => (
          <li key={x.id} className="group card flex flex-col gap-1.5 p-4">
            <div className="flex items-start gap-1">
              <Line
                value={x.kind}
                edit={edit}
                onChange={(v) => patch(x.id, { kind: v })}
                placeholder="Tipo (Storytelling, Desafio…)"
                className="label-mono text-primary"
              />
              {edit ? (
                <RemoveButton
                  label={x.name}
                  onConfirm={() =>
                    set({ series: st.series.filter((y) => y.id !== x.id) }, 'Séries')
                  }
                />
              ) : null}
            </div>
            <Line
              value={x.name}
              edit={edit}
              onChange={(v) => patch(x.id, { name: v })}
              placeholder="Nome da série"
              className="font-display text-lg font-bold"
            />
            <Text
              value={x.description}
              edit={edit}
              onChange={(v) => patch(x.id, { description: v })}
              placeholder="Do que se trata, com quem, até quando"
              className="text-sm text-muted-foreground"
              minRows={2}
            />
          </li>
        ))}
        {edit ? (
          <li>
            <AddButton
              onClick={() =>
                set(
                  {
                    series: [
                      ...st.series,
                      { id: newId('sr'), name: '', kind: '', description: '' },
                    ],
                  },
                  'Séries',
                )
              }
            >
              Nova série
            </AddButton>
          </li>
        ) : null}
      </ul>
    </Section>
  )
}

function CadenceSection({ st, edit, set }: { st: Strategy; edit: boolean; set: SetFn }) {
  const s = useLaunchState()
  const monday = mondayOf(todayIso())
  const rows = weekCadence(contentOf(s), monday)
  const goalOf = (f: CadenceGoal['format']) => st.cadence.find((c) => c.format === f)?.perWeek ?? 0
  const setGoal = (format: CadenceGoal['format'], perWeek: number) => {
    const rest = st.cadence.filter((c) => c.format !== format)
    set({ cadence: perWeek > 0 ? [...rest, { format, perWeek }] : rest }, 'Cadência')
  }
  const perDay = st.cadence.reduce((a, c) => a + c.perWeek, 0) / 7
  if (!edit && st.cadence.length === 0 && !st.cadenceNote) return null
  return (
    <Section
      id="cadencia"
      kicker="Produção"
      title="Cadência de publicação"
      intro="O ritmo que dá para entregar com qualidade. Vira meta no calendário: cada semana mostra o planejado contra a meta."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-4">
          <p className="label-mono mb-3">Meta por semana</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(edit ? FORMATS : FORMATS.filter((f) => goalOf(f) > 0)).map((f) => (
              <li key={f} className="rounded-lg bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted-foreground">{FORMAT_LABEL[f]}</p>
                {edit ? (
                  <GoalInput
                    value={goalOf(f)}
                    onCommit={(n) => setGoal(f, n)}
                    label={FORMAT_LABEL[f]}
                  />
                ) : (
                  <p className="font-display text-3xl font-extrabold tabular-nums">{goalOf(f)}</p>
                )}
              </li>
            ))}
          </ul>
          {perDay > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Cerca de{' '}
              <strong className="text-foreground">
                {perDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
              </strong>{' '}
              publicações por dia.
            </p>
          ) : null}
          <Text
            value={st.cadenceNote}
            edit={edit}
            onChange={(v) => set({ cadenceNote: v }, 'Cadência')}
            placeholder="Regras do ritmo (ex.: carrossel entra 2x por semana no lugar de um reels)"
            className="mt-3 text-sm"
            minRows={2}
          />
        </div>
        {rows.length ? (
          <div className="card p-4">
            <p className="label-mono mb-3">Semana de {formatShort(monday)}</p>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => {
                const pct = Math.min(100, Math.round((r.planned / r.goal) * 100))
                return (
                  <li key={r.format}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{FORMAT_LABEL[r.format]}</span>
                      <span
                        className={`font-bold tabular-nums ${r.planned >= r.goal ? '' : 'text-danger'}`}
                      >
                        {r.planned}/{r.goal}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${r.planned >= r.goal ? 'bg-lime' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  )
}

function GoalInput({
  value,
  onCommit,
  label,
}: {
  value: number
  onCommit: (n: number) => void
  label: string
}) {
  const [draft, setDraft] = useState(String(value || ''))
  const [base, setBase] = useState(value)
  if (base !== value) {
    setBase(value)
    setDraft(String(value || ''))
  }
  return (
    <input
      inputMode="numeric"
      className="w-full bg-transparent font-display text-3xl font-extrabold tabular-nums outline-none placeholder:text-muted-foreground/40"
      placeholder="0"
      aria-label={`Meta semanal de ${label}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
      onBlur={() => {
        const n = Math.min(70, Number(draft) || 0)
        if (n !== value) onCommit(n)
      }}
    />
  )
}
