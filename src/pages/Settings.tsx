import { useEffect, useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import type { Settings } from '../lib/types'
import { Button, Card, Field, Input, PageHeader, Textarea } from '../components/ui'

export function SettingsPage() {
  const { settings, reload } = useStore()
  const [s, setS] = useState<Settings>(settings)
  const [msg, setMsg] = useState('')
  useEffect(() => setS(settings), [settings])

  const text = (k: keyof Settings, label: string, cls = '') => (
    <Field label={label} className={cls}>
      <Input value={String(s[k] ?? '')} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </Field>
  )

  async function save() {
    setMsg('')
    try {
      await db.saveSettings({ ...s, payment_days: Number(s.payment_days), quote_valid_days: Number(s.quote_valid_days) })
      await reload()
      setMsg('Opgeslagen')
    } catch (e) {
      setMsg('Fout: ' + (e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Instellingen" actions={<Button variant="primary" onClick={save}>Opslaan</Button>} />
      {msg && <p className={`mb-3 text-sm ${msg.startsWith('Fout') ? 'text-red-600' : 'text-green-700'}`}>{msg}</p>}
      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-sm font-medium">Bedrijfsgegevens (voettekst factuur)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {text('company_name', 'Bedrijfsnaam')}
          {text('owner_name', 'Naam')}
          {text('address', 'Adres')}
          {text('postal_city', 'Postcode en plaats')}
          {text('phone', 'Telefoon')}
          {text('email', 'E-mail')}
          {text('kvk', 'KvK-nummer')}
          {text('vat_number', 'Btw-nummer')}
          {text('iban', 'IBAN', 'sm:col-span-2')}
        </div>
      </Card>
      <Card className="mb-4 p-4">
        <h2 className="mb-3 text-sm font-medium">Facturen en offertes</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Betaaltermijn (dagen)">
            <Input type="number" value={s.payment_days} onChange={(e) => setS({ ...s, payment_days: Number(e.target.value) })} />
          </Field>
          <Field label="Geldigheid offerte (dagen)">
            <Input type="number" value={s.quote_valid_days} onChange={(e) => setS({ ...s, quote_valid_days: Number(e.target.value) })} />
          </Field>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium">Apparatuurverhuur</h2>
        <div className="space-y-3">
          <Field label="Standaard toelichting (wordt ingevuld bij toevoegen apparatuur)">
            <Textarea rows={4} value={s.rental_note} onChange={(e) => setS({ ...s, rental_note: e.target.value })} />
          </Field>
          {text('rental_list_url', 'Link verhuurlijst (URL)')}
        </div>
      </Card>
      <p className="mt-4 text-xs text-neutral-500">Prijzen van fotografie, video en apparatuur beheer je onder Producten.</p>
    </>
  )
}
