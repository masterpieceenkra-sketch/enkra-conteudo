import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { requestCode, verifyCode } from '../lib/auth'
import { APP_NAME } from '../lib/board'
import { formatBr } from '../lib/phone'

const RESEND_S = 45

/** Entrada por código no WhatsApp. Só números que estão em Usuários recebem código. */
export function LoginScreen() {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const digits = phone.replace(/\D/g, '')
  const phoneOk = digits.length >= 10 && digits.length <= 15

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const msg = await requestCode(phone)
      setInfo(msg)
      setStep('code')
      setResendIn(RESEND_S)
      setCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível pedir o código')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await verifyCode(phone, code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código inválido')
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <form
        className="card w-full max-w-md p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (busy) return
          if (step === 'phone' && phoneOk) void send()
          if (step === 'code' && code.replace(/\D/g, '').length === 6) void confirm()
        }}
      >
        <p className="label-mono">{APP_NAME}</p>
        <h1 className="mt-1.5 text-2xl">Entrar</h1>

        {step === 'phone' ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Digite o WhatsApp cadastrado no time. Você recebe um código de 6 dígitos por lá.
            </p>
            <label className="mt-5 flex flex-col gap-1">
              <span className="label-mono">WhatsApp</span>
              <input
                autoFocus
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="field text-lg"
                placeholder="(85) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary mt-4 w-full" disabled={!phoneOk || busy}>
              <MessageCircle className="size-4" aria-hidden />
              {busy ? 'Enviando…' : 'Receber código no WhatsApp'}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {info} Enviado para <strong className="text-foreground">{formatBr(digits)}</strong>.
            </p>
            <label className="mt-5 flex flex-col gap-1">
              <span className="label-mono">Código</span>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="field text-center font-mono text-2xl tracking-[0.4em]"
                placeholder="000000"
                aria-label="Código de 6 dígitos"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button
              type="submit"
              className="btn-primary mt-4 w-full"
              disabled={code.length !== 6 || busy}
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <div className="mt-3 flex items-center justify-between text-xs">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep('phone')
                  setError(null)
                }}
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Trocar número
              </button>
              <button
                type="button"
                className="font-semibold text-primary disabled:text-muted-foreground"
                disabled={resendIn > 0 || busy}
                onClick={() => void send()}
              >
                {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
              </button>
            </div>
          </>
        )}

        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-muted-foreground">
          Só entra quem está no cadastro do time. Se o código não chegar, fale com quem administra o
          painel.
        </p>
      </form>
    </main>
  )
}
