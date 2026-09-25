import { LogOut, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BOARD_ID, BOARD_MODE, goToHubRoot } from '../lib/board'
import { signOut } from '../lib/auth'
import { isMemberAnywhere } from '../store/boards'
import type { SyncErrorCode } from '../store/sync'

/**
 * Quadro que não abriu: ou não existe, ou o telefone desta sessão não está no cadastro dele.
 * A sessão continua de pé (a pessoa pode ser de outro quadro); só quem não está em quadro
 * nenhum é desconectado, que é o caso de quem saiu do cadastro.
 */
export function BoardProblem({ code }: { code: SyncErrorCode }) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    void isMemberAnywhere().then((member) => {
      if (cancelled) return
      if (!member) void signOut()
      else setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <p className="label-mono flex items-center gap-2">
          <TriangleAlert className="size-4" aria-hidden /> Quadro indisponível
        </p>
        <h1 className="mt-1.5 text-2xl">
          {code === 'not-found' ? 'Não achei este quadro' : 'Você não está neste quadro'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {code === 'not-found'
            ? `Nada foi encontrado no endereço /${BOARD_ID}. Confira o link ou abra um dos seus quadros.`
            : 'Seu WhatsApp não está no cadastro deste quadro. Peça para quem administra ele te incluir.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {BOARD_MODE === 'hub' ? (
            <button type="button" className="btn-primary" onClick={goToHubRoot}>
              Ver meus quadros
            </button>
          ) : null}
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
        {!checked ? <p className="mt-3 text-xs text-muted-foreground">Conferindo acesso…</p> : null}
      </div>
    </main>
  )
}

/**
 * Quadro aberto no app errado: um quadro de conteúdo no Enkra Hub, ou um de lançamento no app
 * de conteúdo. Cada app só sabe desenhar o seu tipo, então manda para o endereço certo.
 */
export function WrongApp({ url, content }: { url: string; content: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <p className="label-mono flex items-center gap-2">
          <TriangleAlert className="size-4" aria-hidden /> Outro app
        </p>
        <h1 className="mt-1.5 text-2xl">
          {content ? 'Este é um quadro de conteúdo' : 'Este quadro não é de conteúdo'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {content
            ? 'Quadros de conteúdo abrem no app de conteúdo, com quadro, calendário e aprovação do cliente.'
            : 'Quadros de lançamento, sprint e em branco abrem no Enkra Hub.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {url ? (
            <a className="btn-primary" href={url}>
              Abrir no app certo
            </a>
          ) : null}
          {BOARD_MODE === 'hub' ? (
            <button type="button" className="btn-ghost" onClick={goToHubRoot}>
              Ver meus quadros
            </button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
