import { boardUrl } from '../lib/board'
import { Copy, ExternalLink, ShieldCheck } from 'lucide-react'
import { parseAdminNumbers } from '../lib/phone'
import { useToast } from './toastContext'

/** Bloco no brief com o link verificador oficial, gerado a partir dos números dos admins. */
export function VerifierLinkCard({ adminNumbers }: { adminNumbers: string }) {
  const toast = useToast()
  const count = parseAdminNumbers(adminNumbers).length
  const url = boardUrl('/verificador')

  return (
    <div className="mt-5 rounded-xl border border-lime/60 bg-lime/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="size-4 text-lime-foreground" aria-hidden /> Link verificador oficial
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Página pública com os números dos admins, para colar nas mensagens anti-golpe do grupo.{' '}
        {count
          ? `${count} número${count > 1 ? 's' : ''} cadastrado${count > 1 ? 's' : ''}.`
          : 'Cadastre os números acima para ela ficar completa.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-surface px-2.5 py-1.5 text-xs">{url}</code>
        <button
          type="button"
          className="btn-ghost h-8 px-2.5 py-0 text-xs"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => toast('Link copiado'))
          }}
        >
          <Copy className="size-3.5" aria-hidden /> Copiar
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-secondary h-8 px-2.5 py-0 text-xs"
        >
          <ExternalLink className="size-3.5" aria-hidden /> Abrir
        </a>
      </div>
    </div>
  )
}
