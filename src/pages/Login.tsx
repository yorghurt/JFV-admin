import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/db'
import { OWNER_EMAIL } from '../lib/owner'
import { Button, Field, Input } from '../components/ui'

export function Login() {
  const [email, setEmail] = useState(OWNER_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError('Inloggen mislukt. Controleer e-mail en wachtwoord.')
    setBusy(false)
  }

  /** Resetlink gaat altijd en alleen naar het vaste adres, ongeacht wat er is ingevuld. */
  async function forgot() {
    setBusy(true)
    setError('')
    setInfo('')
    const { error } = await supabase!.auth.resetPasswordForEmail(OWNER_EMAIL, { redirectTo: `${window.location.origin}/` })
    if (error) setError(error.message.includes('rate') ? 'Te veel pogingen. Probeer het over een uur opnieuw.' : `Versturen mislukt: ${error.message}`)
    else setInfo(`Resetlink verstuurd naar ${OWNER_EMAIL}. Check je inbox (en spam).`)
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10" />
          <h1 className="font-display text-2xl font-bold tracking-wide">Administratie</h1>
        </div>
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Wachtwoord">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>
          Inloggen
        </Button>
        <button type="button" onClick={forgot} disabled={busy} className="w-full text-center text-sm text-stone-500 hover:text-ink">
          Wachtwoord vergeten?
        </button>
      </form>
    </div>
  )
}
