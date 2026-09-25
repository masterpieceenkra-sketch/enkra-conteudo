import { APP_NAME } from '../lib/board'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import { formatBr, parseAdminNumbers, waLink } from '../lib/phone'
import { useLaunchState } from '../store/launchStore'

/**
 * Página pública do link verificador oficial (anti-golpe): lista os números dos admins
 * cadastrados no brief. Sem navegação do painel, para ser enviada aos leads.
 */
export function VerifierPage() {
  const s = useLaunchState()
  const numbers = parseAdminNumbers(s.brief.adminNumeros ?? '')
  const evento = s.brief.nomeEvento?.trim()
  const expert = s.brief.especialista?.trim()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <div className="flex items-center gap-2.5">
          <span className="brand-squares" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="font-display text-lg font-extrabold uppercase leading-none tracking-[-0.04em]">
            {APP_NAME}
          </span>
        </div>
        <p className="label-mono mt-8 flex items-center gap-2">
          <ShieldCheck className="size-4 text-lime" aria-hidden /> Verificador oficial
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">
          Números oficiais{evento ? ` do ${evento}` : ''}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {expert ? `A equipe de ${expert}` : 'Nossa equipe'} só fala com você pelos números abaixo.
          Mensagem de qualquer outro número usando nosso nome é golpe: não clique em links nem faça
          pagamentos.
        </p>

        {numbers.length === 0 ? (
          <div className="card mt-6 p-5 text-sm text-muted-foreground">
            Nenhum número cadastrado ainda.
          </div>
        ) : (
          <ul className="mt-6 grid gap-2">
            {numbers.map((n) => (
              <li key={n.digits} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold tracking-[-0.02em]">
                    {formatBr(n.digits)}
                  </p>
                  {n.name ? <p className="text-sm text-muted-foreground">{n.name}</p> : null}
                </div>
                <a
                  href={waLink(n.digits)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-secondary shrink-0"
                  aria-label={`Abrir conversa com ${n.name || formatBr(n.digits)}`}
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          Nunca pedimos senha, código de verificação ou pagamento fora do checkout oficial. Em
          dúvida, confira aqui antes de responder.
        </p>
      </main>
    </div>
  )
}
