import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { LoginScreen } from './components/LoginScreen'
import { BoardProblem, WrongApp } from './components/BoardProblem'
import { useSyncStatus } from './components/useSyncStatus'
import { APP_FLAVOR, BOARD_MODE, BOARD_VIEW } from './lib/board'
import { boardKind, useLaunchState } from './store/launchStore'
import { useAuth } from './lib/auth'
import { ConfirmProvider } from './components/ConfirmProvider'
import { Layout } from './components/Layout'
import { PageSkeleton } from './components/PageSkeleton'
import { ToastProvider } from './components/Toast'
import { DashboardPage } from './pages/DashboardPage'

// Painel é a rota inicial e fica no chunk principal; as outras carregam sob demanda.
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const BriefPage = lazy(() => import('./pages/BriefPage').then((m) => ({ default: m.BriefPage })))
const CalendarPage = lazy(() =>
  import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const ChecklistPage = lazy(() =>
  import('./pages/ChecklistPage').then((m) => ({ default: m.ChecklistPage })),
)
const DiaryPage = lazy(() => import('./pages/DiaryPage').then((m) => ({ default: m.DiaryPage })))
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const CostsPage = lazy(() => import('./pages/CostsPage').then((m) => ({ default: m.CostsPage })))
const VerifierPage = lazy(() =>
  import('./pages/VerifierPage').then((m) => ({ default: m.VerifierPage })),
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
// Hub de conteúdo (build com VITE_APP=content)
const ContentBoardPage = lazy(() =>
  import('./content/pages/BoardPage').then((m) => ({ default: m.BoardPage })),
)
const ContentCalendarPage = lazy(() =>
  import('./content/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const ContentTimelinePage = lazy(() =>
  import('./content/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })),
)
const ContentFeedPage = lazy(() =>
  import('./content/pages/FeedPage').then((m) => ({ default: m.FeedPage })),
)
const ContentApprovalsPage = lazy(() =>
  import('./content/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const ContentStrategyPage = lazy(() =>
  import('./content/pages/StrategyPage').then((m) => ({ default: m.StrategyPage })),
)
const ContentHome = lazy(() => import('./content/Home').then((m) => ({ default: m.ContentHome })))
// Telas do hub (só existem quando o quadro vem da URL)
const BoardsPage = lazy(() => import('./pages/BoardsPage').then((m) => ({ default: m.BoardsPage })))
const NewBoardPage = lazy(() =>
  import('./pages/NewBoardPage').then((m) => ({ default: m.NewBoardPage })),
)

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export function App() {
  const { pathname } = useLocation()
  const auth = useAuth()
  const sync = useSyncStatus()
  const state = useLaunchState()
  // Página pública para leads: sem cabeçalho, navegação nem login.
  if (pathname === '/verificador')
    return (
      <Suspense fallback={<PageSkeleton />}>
        <VerifierPage />
      </Suspense>
    )
  if (auth.status === 'loading') return <PageSkeleton />
  if (auth.status === 'signed_out') return <LoginScreen />
  // Raiz do hub: escolher o quadro, sem painel nem sincronização.
  if (BOARD_VIEW === 'hub-root')
    return (
      <ToastProvider>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/novo" element={<NewBoardPage />} />
            <Route path="*" element={<BoardsPage />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    )
  // Quadro que não abriu (não existe ou não é seu): explica em vez de derrubar a sessão.
  if (sync.status === 'offline' && (sync.code === 'not-found' || sync.code === 'no-access'))
    return <BoardProblem code={sync.code} />
  // só decide depois que o servidor respondeu: antes disso o estado é o cache local
  const loaded = sync.status === 'synced' || sync.status === 'syncing'
  const isContentBoard = boardKind(state) === 'content'
  if (BOARD_MODE === 'hub' && loaded && isContentBoard !== (APP_FLAVOR === 'content'))
    return <WrongApp url={state.url ?? ''} content={isContentBoard} />
  if (APP_FLAVOR === 'content')
    return (
      <ToastProvider>
        <ConfirmProvider>
          <ScrollToTop />
          <Layout>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<ContentHome />} />
                <Route path="/quadro" element={<ContentBoardPage />} />
                <Route path="/calendario" element={<ContentCalendarPage />} />
                <Route path="/cronograma" element={<ContentTimelinePage />} />
                <Route path="/feed" element={<ContentFeedPage />} />
                <Route path="/aprovar" element={<ContentApprovalsPage />} />
                <Route path="/estrategia" element={<ContentStrategyPage />} />
                <Route path="/historico" element={<HistoryPage />} />
                <Route path="/usuarios" element={<UsersPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </ConfirmProvider>
      </ToastProvider>
    )
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/brief" element={<BriefPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/diario" element={<DiaryPage />} />
              <Route path="/historico" element={<HistoryPage />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/custos" element={<CostsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </ConfirmProvider>
    </ToastProvider>
  )
}
