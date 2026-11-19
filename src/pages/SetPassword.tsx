import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/db'
import { Button, Field, Input } from '../components/ui'

/** Na klikken op de resetlink: nieuw wachtwoord kiezen. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Minimaal 8 tekens.')
    if (pw !== pw2) return setError('De wachtwoorden zijn niet gelijk.')
    setBusy(true)
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(`Opslaan mislukt: ${error.message}`)
    onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-10 w-10" />
          <h1 className="font-display text-2xl font-bold tracking-wide">Nieuw wachtwoord</h1>
        </div>
        <Field label="Nieuw wachtwoord">
          <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
        </Field>
        <Field label="Herhaal wachtwoord">
          <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="primary" className="w-full" disabled={busy}>
          Opslaan en verder
        </Button>
      </form>
    </div>
  )
}
