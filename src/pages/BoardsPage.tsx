import { ArrowRight, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { PageSkeleton } from '../components/PageSkeleton'
import { BOARD_KIND_INFO } from '../data/types'
import { signOut } from '../lib/auth'
import { APP_FLAVOR, APP_NAME } from '../lib/board'
import { useMyBoards, usePlatformOwner } from '../store/boards'
import { ClientsOverview } from '../content/ClientsOverview'

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/** Raiz do hub: os quadros em que a pessoa logada está cadastrada. */
export function BoardsPage() {
  const { boards, loading, error } = useMyBoards()
  const owner = usePlatformOwner()
  useEffect(() => {
    document.title = `Meus quadros · ${APP_NAME}`
  }, [])

  return (
    <main
      className={`mx-auto min-h-dvh w-full px-4 py-10 sm:px-6 ${APP_FLAVOR === 'content' ? 'max-w-6xl' : 'max-w-4xl'}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-mono">{APP_NAME}</p>
        <button
          type="button"
          className="btn-ghost h-8 px-2.5 py-0 text-xs"
          onClick={() => void signOut()}
        >
          <LogOut className="size-3.5" aria-hidden /> Sair
        </button>
      </header>
      <h1 className="mt-1.5 text-3xl">Meus quadros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {APP_FLAVOR === 'content'
          ? 'Cada cliente tem o próprio quadro de conteúdo, com o time, o calendário e a aprovação dele. Você só vê os quadros em que está cadastrado.'
          : 'Cada cliente tem o próprio quadro, com o time, as tarefas e os avisos dele. Você só vê os quadros em que está cadastrado.'}
      </p>

      {owner ? (
        <Link to="/novo" className="btn-primary mt-5 inline-flex">
          <Plus className="size-4" aria-hidden /> Novo quadro
        </Link>
      ) : null}

      {loading ? (
        <PageSkeleton />
      ) : error ? (
        <p className="card mt-5 p-5 text-sm text-danger" role="alert">
          Não consegui carregar seus quadros: {error}
        </p>
      ) : boards.length === 0 ? (
        <div className="card mt-5 p-5 text-sm text-muted-foreground">
          Seu número ainda não está em nenhum quadro. Peça para quem administra te cadastrar.
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
            <li key={b.id}>
              <a
                href={`/${b.id}`}
                className="card flex h-full flex-col gap-2 p-4 transition-colors hover:border-primary sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl">{b.name}</h2>
                  {b.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-lime px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-lime-foreground">
                      <ShieldCheck className="size-3" aria-hidden /> admin
                    </span>
                  ) : b.role === 'client' ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-blue-soft px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.12em]">
                      cliente
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {BOARD_KIND_INFO[b.kind]?.title ?? b.kind} · /{b.id}
                </p>
                <p className="mt-auto flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                  <span>
                    {b.tasks_open}{' '}
                    {b.kind === 'content'
                      ? b.tasks_open === 1
                        ? 'card em andamento'
                        : 'cards em andamento'
                      : b.tasks_open === 1
                        ? 'tarefa aberta'
                        : 'tarefas abertas'}{' '}
                    · {b.people} {b.people === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  <ArrowRight className="ml-auto size-4 text-primary" aria-hidden />
                </p>
                {b.updated_at ? (
                  <p className="text-xs text-muted-foreground">Mexido em {when(b.updated_at)}</p>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
      {APP_FLAVOR === 'content' && boards.some((b) => b.role !== 'client') ? (
        <ClientsOverview />
      ) : null}
    </main>
  )
}
