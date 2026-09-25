import { useEffect, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import { APP_FLAVOR, BOARD_MODE } from '../lib/board'
import { navFor } from '../content/nav'
import { useIsClient } from '../content/roles'
import { boardKind, boardName, useLaunchState } from '../store/launchStore'
import { DataMenu } from './DataMenu'
import { NAV } from './nav'
import { SaveIndicator } from './SaveIndicator'
import { ThemeToggle } from './ThemeToggle'

export function Layout({ children }: { children: ReactNode }) {
  const state = useLaunchState()
  const name = boardName(state)
  const isLaunch = boardKind(state) === 'launch'
  const isContent = APP_FLAVOR === 'content'
  const client = useIsClient()
  const nav = isContent ? navFor(client) : NAV
  // no celular a barra de baixo mostra no máximo 5; o resto vai para o menu ⋮
  const mobileNav = nav.filter((n) => !('mobileMore' in n && n.mobileMore))
  // o quadro de conteúdo é largo (colunas lado a lado); o resto do app lê melhor estreito
  const width = isContent ? 'max-w-[1480px]' : 'max-w-6xl'
  useEffect(() => {
    if (BOARD_MODE === 'hub') document.title = name
  }, [name])
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-secondary focus:px-3 focus:py-2 focus:text-secondary-foreground"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className={`mx-auto flex ${width} items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3`}>
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2.5"
            aria-label={`${name}, início`}
          >
            <span className="brand-squares shrink-0" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="truncate font-display text-lg font-extrabold uppercase leading-none tracking-[-0.04em] sm:text-xl">
              {name}
            </span>
          </NavLink>
          <span
            className={`hidden h-5 w-px shrink-0 bg-border ${isContent ? 'xl:block' : 'sm:block'}`}
            aria-hidden
          />
          <span className={`label-mono hidden ${isContent ? 'xl:inline' : 'sm:inline'}`}>
            {BOARD_MODE === 'single'
              ? 'GPS do Lançamento'
              : isContent
                ? client
                  ? 'Área do cliente'
                  : 'Conteúdo'
                : isLaunch
                  ? 'Lançamento'
                  : 'Quadro'}
          </span>

          <nav
            aria-label="Principal"
            className={`ml-auto hidden items-center gap-1 ${isContent ? 'lg:flex' : 'md:flex'}`}
          >
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className={`ml-auto flex items-center gap-1 ${isContent ? 'lg:ml-2' : 'md:ml-2'}`}>
            <SaveIndicator />
            <ThemeToggle />
            <DataMenu />
          </div>
        </div>
      </header>

      <main id="conteudo" className={`mx-auto ${width} px-4 pt-5 pb-8 sm:px-5 sm:py-8`}>
        {children}
      </main>

      <footer
        className={`mt-8 border-t border-border bg-secondary pb-24 text-secondary-foreground sm:mt-10 ${isContent ? 'lg:pb-0' : 'md:pb-0'}`}
      >
        <div
          className={`mx-auto flex ${width} flex-col gap-5 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-5 sm:py-10`}
        >
          <div>
            <p className="font-display text-2xl font-extrabold uppercase leading-none tracking-[-0.04em]">
              {BOARD_MODE === 'single' && !isContent ? 'GPS do Lançamento' : name}
            </p>
            <p className="mt-2 text-sm opacity-70">
              {isContent
                ? 'Da ideia ao post no ar, com o cliente junto'
                : 'Estrutura que sustenta o que você já construiu'}{' '}
              · {name}
            </p>
          </div>
          <span className="brand-squares" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </div>
      </footer>

      <nav
        aria-label="Principal (celular)"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur ${isContent ? 'lg:hidden' : 'md:hidden'}`}
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
        >
          {mobileNav.map((n) => {
            const Icon = n.icon
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                <Icon className="size-5" strokeWidth={2} aria-hidden />
                {n.short}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
