import {
  Download,
  History,
  Wallet,
  LayoutGrid,
  LogOut,
  MoreVertical,
  RotateCcw,
  Upload,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { signOut } from '../lib/auth'
import { APP_FLAVOR, BOARD_MODE, goToHubRoot } from '../lib/board'
import { CONTENT_NAV } from '../content/nav'
import { SYNC_ENABLED } from '../lib/supabase'
import { useActor, useIsAdmin } from './useActor'
import { useEffect, useRef, useState } from 'react'
import { exportJson, useLaunchActions, useLaunchState } from '../store/launchStore'
import { ConfirmDialog } from './ConfirmDialog'
import { useToast } from './toastContext'

/** Um backup real tem dezenas de KB; 5 MB já é sinal de arquivo errado. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export function DataMenu() {
  const state = useLaunchState()
  const { importState, resetAll } = useLaunchActions()
  const toast = useToast()
  const navigate = useNavigate()
  const actor = useActor()
  const isAdmin = useIsAdmin()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function download() {
    const blob = new Blob([exportJson(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `gps-lancamento-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
    toast('Backup exportado')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      toast('Arquivo grande demais para ser um backup deste app', 'error')
      return
    }
    try {
      const text = await file.text()
      importState(JSON.parse(text))
      toast('Backup importado')
    } catch (err) {
      toast(
        err instanceof Error ? `Não foi possível importar: ${err.message}` : 'Arquivo inválido',
        'error',
      )
    }
    setOpen(false)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Dados: exportar, importar ou zerar"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="fade-in absolute right-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {APP_FLAVOR === 'content' ? (
            <div className="lg:hidden">
              {CONTENT_NAV.filter((n) => n.mobileMore).map((n) => {
                const Icon = n.icon
                return (
                  <MenuItem
                    key={n.to}
                    icon={<Icon className="size-4" />}
                    onClick={() => {
                      setOpen(false)
                      void navigate(n.to)
                    }}
                  >
                    {n.label}
                  </MenuItem>
                )
              })}
              <div className="my-1 h-px bg-border" />
            </div>
          ) : null}
          {SYNC_ENABLED ? (
            <>
              {isAdmin ? (
                <MenuItem
                  icon={<Users className="size-4" />}
                  onClick={() => {
                    setOpen(false)
                    void navigate('/usuarios')
                  }}
                >
                  Usuários e avisos
                </MenuItem>
              ) : null}
              {isAdmin && APP_FLAVOR !== 'content' ? (
                <MenuItem
                  icon={<Wallet className="size-4" />}
                  onClick={() => {
                    setOpen(false)
                    void navigate('/custos')
                  }}
                >
                  Custos
                </MenuItem>
              ) : null}
              <MenuItem
                icon={<History className="size-4" />}
                onClick={() => {
                  setOpen(false)
                  void navigate('/historico')
                }}
              >
                Histórico
              </MenuItem>
              <MenuItem
                icon={<LogOut className="size-4" />}
                onClick={() => {
                  setOpen(false)
                  void signOut()
                }}
              >
                Sair{actor ? ` (${actor})` : ''}
              </MenuItem>
              {BOARD_MODE === 'hub' ? (
                <MenuItem
                  icon={<LayoutGrid className="size-4" />}
                  onClick={() => {
                    setOpen(false)
                    goToHubRoot()
                  }}
                >
                  Meus quadros
                </MenuItem>
              ) : null}
              <div className="my-1 h-px bg-border" />
            </>
          ) : null}
          <MenuItem icon={<Download className="size-4" />} onClick={download}>
            Exportar backup (.json)
          </MenuItem>
          {isAdmin ? (
            <>
              <MenuItem
                icon={<Upload className="size-4" />}
                onClick={() => fileRef.current?.click()}
              >
                Importar backup
              </MenuItem>
              <div className="my-1 h-px bg-border" />
              <MenuItem
                icon={<RotateCcw className="size-4" />}
                danger
                onClick={() => {
                  setOpen(false)
                  setConfirmReset(true)
                }}
              >
                Zerar tudo
              </MenuItem>
            </>
          ) : null}
          <p className="px-3 pb-1.5 pt-2 text-[11px] leading-snug text-muted-foreground">
            {SYNC_ENABLED
              ? 'Os dados são compartilhados com o time e salvos no banco. O backup é uma cópia extra.'
              : 'Os dados ficam só neste navegador. Exporte um backup antes de trocar de aparelho.'}
          </p>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <ConfirmDialog
        open={confirmReset}
        title="Zerar todos os dados?"
        description="Brief, datas, tarefas e diário voltam ao modelo original. Isso não pode ser desfeito. Exporte um backup antes se tiver dúvida."
        confirmLabel="Zerar tudo"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll()
          setConfirmReset(false)
          toast('Dados zerados')
        }}
      />
    </div>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted ${
        danger ? 'text-danger' : ''
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
