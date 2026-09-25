import {
  BadgeCheck,
  BellOff,
  BellRing,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../components/confirmContext'
import { useToast } from '../components/toastContext'
import { isValidEmail, isValidPhone } from '../lib/actor'
import { formatBr as formatPhone } from '../lib/phone'
import type { Person } from '../data/types'
import { MAX_PHONES, personPhones, useLaunchActions, useLaunchState } from '../store/launchStore'
import { NotificationStatus } from '../components/NotificationStatus'
import { useIsAdmin, useMe } from '../components/useActor'
import { APP_FLAVOR } from '../lib/board'

/** Papel Cliente só existe no hub de conteúdo: quem aprova os posts sem editar o quadro. */
const HAS_CLIENTS = APP_FLAVOR === 'content'

type Draft = Omit<Person, 'id'>
const EMPTY: Draft = { name: '', email: '', phone: '', role: '', notify: true }

export function UsersPage() {
  const s = useLaunchState()
  const { addPerson, patchPerson, removePerson } = useLaunchActions()
  const confirm = useConfirm()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const isAdmin = useIsAdmin()
  const me = useMe()

  const people = [...s.people].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const adminCount = s.people.filter((p) => p.admin).length

  if (!isAdmin)
    return (
      <>
        <PageHeader kicker="Time" title="Usuários">
          Esta tela é só para quem administra o painel.
        </PageHeader>
        <div className="card mt-5 flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <ShieldCheck className="size-5" aria-hidden /> Peça a um admin para cadastrar ou alterar
          alguém do time.
        </div>
      </>
    )

  return (
    <>
      <PageHeader
        kicker="Time"
        title="Usuários"
        actions={
          !adding ? (
            <button type="button" className="btn-secondary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Cadastrar pessoa
            </button>
          ) : null
        }
      >
        Quem faz parte do lançamento. Só quem está aqui consegue entrar no painel (código no
        WhatsApp). Ao cadastrar, a pessoa recebe uma boas-vindas com o link, e depois os avisos de
        tarefa, prazo e reunião. Admins veem esta tela e configuram os avisos.
      </PageHeader>

      <NotificationStatus />

      {adding ? (
        <PersonForm
          initial={EMPTY}
          submitLabel="Cadastrar"
          onCancel={() => setAdding(false)}
          onSubmit={(d) => {
            if (addPerson(d)) {
              setAdding(false)
              toast('Pessoa cadastrada')
            }
          }}
        />
      ) : null}

      {people.length === 0 && !adding ? (
        <div className="card mt-5 flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <UserRound className="size-5" aria-hidden /> Ninguém cadastrado ainda. Cadastre o time
          para escolher responsáveis pela lista.
        </div>
      ) : null}

      <ul className="mt-5 grid gap-2">
        {people.map((p) =>
          editingId === p.id ? (
            <li key={p.id}>
              <PersonForm
                initial={p}
                submitLabel="Salvar"
                onCancel={() => setEditingId(null)}
                onSubmit={(d) => {
                  patchPerson(p.id, d)
                  setEditingId(null)
                }}
              />
            </li>
          ) : (
            <li key={p.id} className="card flex items-center gap-3 p-3 sm:p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold uppercase text-secondary-foreground">
                {p.name.trim().slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {p.name}
                  {p.admin ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-lime px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-lime-foreground"
                      title="Administra o cadastro e os avisos"
                    >
                      <ShieldCheck className="size-3" aria-hidden /> admin
                    </span>
                  ) : null}
                  {p.finance ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-aqua px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-aqua-foreground"
                      title="Recebe os custos publicados e decide"
                    >
                      <Wallet className="size-3" aria-hidden /> financeiro
                    </span>
                  ) : null}
                  {p.client ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm bg-blue px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-blue-foreground"
                      title="Vê o quadro, comenta e aprova ou pede ajuste; não edita"
                    >
                      <BadgeCheck className="size-3" aria-hidden /> cliente
                    </span>
                  ) : null}
                  {p.role ? (
                    <span className="rounded-sm bg-primary px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                      {p.role}
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.email || 'sem e-mail'} ·{' '}
                  {personPhones(p).map(formatPhone).join(' · ') || 'sem WhatsApp'}
                </p>
              </div>
              <button
                type="button"
                className={`chip ${p.admin ? 'chip-active' : ''}`}
                aria-pressed={!!p.admin}
                disabled={!!p.admin && adminCount <= 1}
                title={
                  p.admin
                    ? adminCount <= 1
                      ? 'Único admin: cadastre outro antes de tirar'
                      : 'Admin: clique para tirar'
                    : 'Tornar admin'
                }
                onClick={() => {
                  patchPerson(p.id, { admin: !p.admin })
                  toast(p.admin ? `${p.name} deixou de ser admin` : `${p.name} agora é admin`)
                }}
              >
                <ShieldCheck className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{p.admin ? 'Admin' : 'Tornar admin'}</span>
              </button>
              {HAS_CLIENTS && !p.admin ? (
                <button
                  type="button"
                  className={`chip ${p.client ? 'chip-active' : ''}`}
                  aria-pressed={!!p.client}
                  title={
                    p.client
                      ? 'Cliente: só vê, comenta e aprova. Clique para voltar a ser do time'
                      : 'Marcar como cliente (aprova os conteúdos, não edita)'
                  }
                  onClick={() => {
                    patchPerson(p.id, { client: !p.client })
                    toast(
                      p.client
                        ? `${p.name} agora é do time e edita o quadro`
                        : `${p.name} agora é cliente: aprova e comenta`,
                    )
                  }}
                >
                  <BadgeCheck className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">{p.client ? 'Cliente' : 'Cliente?'}</span>
                </button>
              ) : null}
              {p.admin && !HAS_CLIENTS ? (
                <button
                  type="button"
                  className={`chip ${p.finance ? 'chip-active' : ''}`}
                  aria-pressed={!!p.finance}
                  title={
                    p.finance
                      ? 'Financeiro: recebe os custos e decide. Clique para tirar'
                      : 'Colocar no financeiro'
                  }
                  onClick={() => {
                    patchPerson(p.id, { finance: !p.finance })
                    toast(
                      p.finance
                        ? `${p.name} saiu do financeiro`
                        : `${p.name} agora recebe e aprova os custos`,
                    )
                  }}
                >
                  <Wallet className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">
                    {p.finance ? 'Financeiro' : 'Financeiro?'}
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                className={`chip ${p.notify ? 'chip-active' : ''}`}
                aria-pressed={p.notify}
                title={p.notify ? 'Recebe avisos no WhatsApp' : 'Não recebe avisos'}
                onClick={() => patchPerson(p.id, { notify: !p.notify })}
              >
                {p.notify ? (
                  <BellRing className="size-3.5" aria-hidden />
                ) : (
                  <BellOff className="size-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">
                  {p.notify ? 'Avisos ligados' : 'Avisos desligados'}
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Editar ${p.name}`}
                onClick={() => setEditingId(p.id)}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn hover:text-danger"
                aria-label={`Remover ${p.name}`}
                disabled={!!p.admin && adminCount <= 1}
                title={p.admin && adminCount <= 1 ? 'Único admin não pode ser removido' : undefined}
                onClick={() =>
                  confirm({
                    title: `Remover ${p.name}?`,
                    description:
                      (p.id === me?.id
                        ? 'Você vai perder o acesso ao painel. '
                        : 'A pessoa perde o acesso ao painel. ') +
                      'As tarefas dela ficam sem responsável na lista (o nome continua no texto).',
                    confirmLabel: 'Remover',
                    danger: true,
                    onConfirm: () => removePerson(p.id),
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
    </>
  )
}

function PersonForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  submitLabel: string
  onSubmit: (d: Draft) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [phones, setPhones] = useState<string[]>(() => {
    const list = personPhones(initial).map(formatPhone)
    return list.length ? list : ['']
  })
  const [touched, setTouched] = useState(false)
  const emailOk = d.email.trim() === '' || isValidEmail(d.email)
  // o WhatsApp é a chave de entrada no painel, então pelo menos um é obrigatório
  const filled = phones.map((v) => v.trim()).filter(Boolean)
  const phoneOk = filled.length > 0 && filled.every(isValidPhone)
  const valid = d.name.trim() !== '' && emailOk && phoneOk
  return (
    <form
      className="fade-in card mt-5 grid gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (valid) onSubmit({ ...d, phones: filled })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="label-mono">Nome</span>
          <input
            autoFocus
            className="field"
            value={d.name}
            maxLength={80}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-mono">E-mail</span>
          <input
            type="email"
            className={`field ${touched && !emailOk ? 'border-danger' : ''}`}
            value={d.email}
            maxLength={160}
            onChange={(e) => setD({ ...d, email: e.target.value })}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="label-mono">WhatsApp (com DDD)</span>
          {phones.map((value, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                type="tel"
                className={`field ${touched && !phoneOk ? 'border-danger' : ''}`}
                placeholder={i === 0 ? '(85) 99999-0000' : 'Outro número'}
                aria-label={i === 0 ? 'WhatsApp principal' : `WhatsApp ${i + 1}`}
                value={value}
                maxLength={30}
                onChange={(e) =>
                  setPhones((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))
                }
              />
              {phones.length > 1 ? (
                <button
                  type="button"
                  className="btn-ghost size-9 shrink-0 justify-center p-0"
                  aria-label={`Remover número ${i + 1}`}
                  onClick={() => setPhones((cur) => cur.filter((_, j) => j !== i))}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {phones.length < MAX_PHONES ? (
            <button
              type="button"
              className="self-start text-xs font-semibold text-primary"
              onClick={() => setPhones((cur) => [...cur, ''])}
            >
              + Outro número
            </button>
          ) : null}
        </div>
        <label className="flex flex-col gap-1">
          <span className="label-mono">Qual seu cargo?</span>
          <input
            className="field"
            placeholder="Ex.: Copywriter"
            value={d.role ?? ''}
            maxLength={60}
            onChange={(e) => setD({ ...d, role: e.target.value })}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={d.notify}
          onChange={(e) => setD({ ...d, notify: e.target.checked })}
        />
        {HAS_CLIENTS
          ? 'Receber avisos no WhatsApp (card novo, prazo, aprovação)'
          : 'Receber avisos no WhatsApp (tarefa nova, prazo amanhã, reunião)'}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={!!d.admin}
          onChange={(e) => setD({ ...d, admin: e.target.checked, client: false })}
        />
        Admin: vê e edita Usuários, avisos e backups
      </label>
      {HAS_CLIENTS ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={!!d.client}
            onChange={(e) => setD({ ...d, client: e.target.checked, admin: false })}
          />
          Cliente: vê o quadro, comenta e aprova ou pede ajuste, sem editar
        </label>
      ) : null}
      {touched && !valid ? (
        <p className="text-xs text-danger">
          Nome e WhatsApp são obrigatórios (o WhatsApp é a chave para entrar); e-mail, se
          preenchido, precisa ser válido. O primeiro número é o principal; os outros também entram
          no login e recebem os avisos.
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
