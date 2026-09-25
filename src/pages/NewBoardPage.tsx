import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BOARD_KINDS, BOARD_KIND_INFO, type BoardKind } from '../data/types'
import { isValidPhone } from '../lib/actor'
import { APP_FLAVOR, isValidSlug, slugify } from '../lib/board'
import { sessionPhone } from '../lib/auth'
import { todayIso } from '../lib/dates'
import { buildInitialState, newId, normalizePhone } from '../store/launchStore'
import { createBoard, slugAvailable, usePlatformOwner } from '../store/boards'

/** Cria o quadro de um cliente: nome, endereço, modelo e quem administra. */
export function NewBoardPage() {
  const owner = usePlatformOwner()
  const myPhone = sessionPhone()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const isContent = APP_FLAVOR === 'content'
  const [kind, setKind] = useState<BoardKind>(isContent ? 'content' : 'launch')
  const [start, setStart] = useState(todayIso())
  const [myName, setMyName] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [checked, setChecked] = useState<{ id: string; free: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const id = slugTouched ? slug : slugify(name)
  const slugOk = isValidSlug(id)
  const clientFilled = clientName.trim() !== '' || clientPhone.trim() !== ''
  const clientOk = !clientFilled || (clientName.trim() !== '' && isValidPhone(clientPhone))
  // resultado vale só para o endereço conferido; enquanto muda, volta a "conferindo"
  const free = checked && checked.id === id ? checked.free : null
  const valid = name.trim() !== '' && slugOk && myName.trim() !== '' && clientOk && free !== false

  useEffect(() => {
    if (!slugOk) return
    let cancelled = false
    const t = setTimeout(() => {
      void slugAvailable(id).then((ok) => {
        if (!cancelled) setChecked({ id, free: ok })
      })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [id, slugOk])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const state = buildInitialState(kind === 'launch' ? start : todayIso(), kind)
      state.name = name.trim().slice(0, 60)
      state.people = [
        {
          id: newId('p'),
          name: myName.trim(),
          email: '',
          phone: normalizePhone(myPhone),
          notify: true,
          admin: true,
        },
        ...(clientFilled
          ? [
              {
                id: newId('p'),
                name: clientName.trim(),
                email: '',
                phone: normalizePhone(clientPhone),
                notify: true,
                // no hub de conteúdo o cliente aprova; não administra o quadro
                ...(isContent ? { client: true } : { admin: true }),
              },
            ]
          : []),
      ]
      const created = await createBoard(id, state)
      window.location.assign(`/${created}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui criar o quadro')
      setBusy(false)
    }
  }

  if (!owner)
    return (
      <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="card p-5 text-sm text-muted-foreground">
          Só quem administra a plataforma cria quadro.{' '}
          <Link to="/" className="font-semibold text-primary">
            Voltar para meus quadros
          </Link>
        </div>
      </main>
    )

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Meus quadros
      </Link>
      <h1 className="mt-2 text-3xl">Novo quadro</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isContent
          ? 'Um quadro de conteúdo por cliente, já com as colunas de ideia até publicado.'
          : 'Um quadro por cliente. Quem entra no quadro é só quem está no cadastro dele.'}
      </p>

      <form
        className="card mt-5 grid gap-4 p-4 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) void submit()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="label-mono">Nome do quadro</span>
          <input
            autoFocus
            className="field"
            placeholder="Ex.: Estúdio Aurora"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="label-mono">Endereço</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">/</span>
            <input
              className={`field ${id && !slugOk ? 'border-danger' : ''}`}
              placeholder="estudio-aurora"
              maxLength={40}
              value={id}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {!id
              ? 'Minúsculas, números e hífen.'
              : !slugOk
                ? 'Endereço inválido ou reservado.'
                : free === null
                  ? 'Conferindo…'
                  : free
                    ? 'Endereço livre.'
                    : 'Já existe um quadro nesse endereço.'}
          </span>
        </label>

        {!isContent ? (
          <fieldset className="grid gap-2">
            <legend className="label-mono mb-1">Modelo</legend>
            {BOARD_KINDS.map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  kind === k ? 'border-primary bg-surface-2' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  className="mt-1"
                  checked={kind === k}
                  onChange={() => setKind(k)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{BOARD_KIND_INFO[k].title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {BOARD_KIND_INFO[k].hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {kind === 'launch' ? (
          <label className="flex flex-col gap-1">
            <span className="label-mono">Início do lançamento</span>
            <input
              type="date"
              className="field sm:w-auto"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
        ) : null}

        <div className="grid gap-3 border-t border-border pt-4">
          <p className="label-mono">Quem administra</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Você ({myPhone ? `WhatsApp ${myPhone}` : 'sessão atual'})
            </span>
            <input
              className="field"
              placeholder="Seu nome"
              maxLength={80}
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {isContent ? 'Cliente que aprova (opcional)' : 'Admin do cliente (opcional)'}
              </span>
              <input
                className="field"
                placeholder="Nome"
                maxLength={80}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">WhatsApp</span>
              <input
                type="tel"
                className={`field ${clientFilled && !clientOk ? 'border-danger' : ''}`}
                placeholder="(85) 99999-0000"
                maxLength={30}
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {isContent
              ? 'Você entra como admin e o cliente entra só para ver e aprovar. Os dois recebem as boas-vindas com o link. O time entra depois, em Usuários.'
              : 'Os dois entram como admin e recebem as boas-vindas com o link do quadro. Mais gente entra depois, em Usuários.'}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!valid || busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {busy ? 'Criando…' : 'Criar quadro'}
          </button>
        </div>
      </form>
    </main>
  )
}
