import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/db'
import { Button, Field, Input } from '../components/ui'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) setError('Inloggen mislukt. Controleer e-mail en wachtwoord.')
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10" />
          <h1 className="text-lg font-semibold">Administratie</h1>
        </div>
        <Field label="E-mail">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Wachtwoord">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>
          Inloggen
        </Button>
      </form>
    </div>
  )
}
