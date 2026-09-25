/**
 * De qual quadro é esta página. Resolvido uma vez, no carregamento, porque o id do quadro é
 * lido por módulos que rodam fora do React (transporte, login, histórico).
 *
 * Dois modos, decididos pela variável de build:
 * - `single` (VITE_LAUNCH_ID definido): um deploy por cliente, sem prefixo na URL. É o deploy
 *   da Comu, que continua exatamente como sempre foi.
 * - `hub` (sem a variável): um deploy para vários clientes, o quadro vem do primeiro pedaço do
 *   caminho (`/aurora/checklist`). Sem quadro na URL, a página é a lista "Meus quadros".
 *
 * Trocar de quadro é navegação de página inteira (`goToBoard`): recarregar zera o estado em
 * memória, a sincronização e os canais de tempo real de uma vez.
 */

/** Caminhos do hub que nunca podem ser confundidos com um quadro. */
const RESERVED = new Set([
  'novo',
  'quadros',
  'entrar',
  'sair',
  'verificador',
  'assets',
  'api',
  'favicon.svg',
  'theme.js',
])

/** Slug de quadro: minúsculas, números e hífen; 2 a 40 caracteres. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/

export function isValidSlug(v: string): boolean {
  return SLUG_RE.test(v) && !RESERVED.has(v)
}

/** Sugere um slug a partir do nome do quadro ("Estúdio Aurora" → "estudio-aurora"). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

const envId = ((import.meta.env.VITE_LAUNCH_ID as string | undefined) ?? '').trim().slice(0, 64)

export const BOARD_MODE: 'single' | 'hub' = envId ? 'single' : 'hub'

function firstSegment(): string {
  if (typeof window === 'undefined') return ''
  const raw = window.location.pathname.split('/').filter(Boolean)[0] ?? ''
  try {
    return decodeURIComponent(raw).toLowerCase()
  } catch {
    return ''
  }
}

const segment = BOARD_MODE === 'hub' ? firstSegment() : ''

/** Id do quadro desta página; vazio só na raiz do hub. */
export const BOARD_ID = BOARD_MODE === 'single' ? envId : isValidSlug(segment) ? segment : ''

/** Prefixo das rotas (basename do router): vazio no modo single. */
export const BASE_PATH = BOARD_MODE === 'single' || !BOARD_ID ? '' : `/${BOARD_ID}`

/** `board` mostra o painel do quadro; `hub-root` mostra a lista de quadros. */
export const BOARD_VIEW: 'board' | 'hub-root' =
  BOARD_MODE === 'single' || BOARD_ID ? 'board' : 'hub-root'

/** URL absoluta de um caminho dentro deste quadro (para links que saem do app). */
export function boardUrl(path = ''): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${BASE_PATH}${path}`
}

/**
 * Qual app este build é. O mesmo código gera dois produtos:
 * - `launch`: Comu HUB e Enkra Hub (lançamento, sprint, quadro em branco);
 * - `content` (VITE_APP=content): o hub de conteúdo de social media, com URL própria.
 * Cada um só abre e lista os quadros do seu tipo.
 */
export const APP_FLAVOR: 'launch' | 'content' =
  (import.meta.env.VITE_APP as string | undefined) === 'content' ? 'content' : 'launch'

/** Nome do produto nesta instalação: o painel de um cliente só, o hub da agência ou o de conteúdo. */
export const APP_NAME =
  APP_FLAVOR === 'content' ? 'Enkra Conteúdo' : BOARD_MODE === 'single' ? 'Comu HUB' : 'Enkra Hub'

/** Chave de armazenamento local separada por quadro, para um cliente não ver o cache do outro. */
export function storageKey(base: string): string {
  return BOARD_MODE === 'single' ? base : `${base}:${BOARD_ID || 'hub'}`
}

/** Prefixos das chaves que guardam dados de quadro (usado na limpeza ao sair). */
export const BOARD_STORAGE_PREFIXES = ['gps-lancamento-v2', 'gps-actor', 'gps-collapsed-areas']

export function goToBoard(slug: string): void {
  window.location.assign(`/${slug}`)
}

export function goToHubRoot(): void {
  window.location.assign('/')
}
