import { useEffect, useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import type { Settings } from '../lib/types'
import { Button, Card, Field, Input, PageHeader, Textarea } from '../components/ui'
import { FolderPicker } from '../components/FolderPicker'
import { GOOGLE_ENABLED, getToken, isConnected } from '../lib/google'
import { download, todayIso } from '../lib/calc'

export function SettingsPage() {
  const store = useStore()
  const { settings, reload } = store
  const [backupMsg, setBackupMsg] = useState('')
  const [s, setS] = useState<Settings>(settings)
  const [msg, setMsg] = useState('')
  const [pick, setPick] = useState<'invoices' | 'receipts' | null>(null)
  const [connected, setConnected] = useState(isConnected())
  useEffect(() => setS(settings), [settings])

  const area = (k: keyof Settings, label: string, rows = 6) => (
    <Field label={label}>
      <Textarea rows={rows} value={String(s[k] ?? '')} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </Field>
  )

  async function backup() {
    setBackupMsg('Back-up voorbereiden…')
    try {
      const { buildBackup } = await import('../lib/backup')
      const blob = await buildBackup({ settings, clients: store.clients, products: store.products, docs: store.docs, expenses: store.expenses }, setBackupMsg)
      download(`JFV-administratie back-up ${todayIso()}.zip`, blob)
      setBackupMsg(`Klaar: ${(blob.size / 1024 / 1024).toFixed(1)} MB gedownload.`)
    } catch (e) {
      setBackupMsg('Fout: ' + (e as Error).message)
    }
  }

  const [driveMsg, setDriveMsg] = useState('')

  /** Alle definitieve (en geïmporteerde) facturen in Drive zetten; standaard alleen wat er nog niet staat. */
  async function bulkDrive(all: boolean) {
    const { saveToDrive } = await import('../lib/docs')
    const list = store.docs.filter((d) => d.doc_type === 'factuur' && d.number && d.status !== 'concept' && (!d.imported || d.file_path) && (all || !d.drive_saved_at))
    if (!list.length) return setDriveMsg('Alle facturen staan al in Drive.')
    const failed: string[] = []
    for (const [i, d] of list.entries()) {
      setDriveMsg(`Factuur ${d.number} (${i + 1} van ${list.length})…`)
      try {
        await saveToDrive(d, settings, store.docs.find((x) => x.id === d.credit_of)?.number)
      } catch (e) {
        failed.push(`${d.number}: ${(e as Error).message}`)
      }
    }
    await reload()
    setDriveMsg(
      failed.length
        ? `Fout bij ${failed.length} van ${list.length}: ${failed.join(' · ')}`
        : `${list.length} ${list.length === 1 ? 'factuur' : 'facturen'} in Google Drive gezet (${settings.drive_invoices_name}/Q1–Q4).`,
    )
  }

  async function connect() {
    try {
      await getToken()
      setConnected(true)
    } catch (e) {
      setMsg('Fout: ' + (e as Error).message)
    }
  }

  async function pickFolder(which: 'invoices' | 'receipts', f: { id: string; name: string }) {
    const next = which === 'invoices' ? { ...s, drive_invoices_id: f.id, drive_invoices_name: f.name } : { ...s, drive_receipts_id: f.id, drive_receipts_name: f.name }
    setS(next)
    setPick(null)
    await db.saveSettings(next)
    await reload()
    setMsg('Map opgeslagen')
  }

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
      <Card className="mt-4 p-4">
        <h2 className="mb-1 text-sm font-medium">Back-up</h2>
        <p className="mb-3 text-xs text-stone-500">
          Eén zip met alle gegevens (Excel-overzichten en JSON), alle bonnen en oude facturen, en een PDF van elke factuur en offerte. Advies: elk kwartaal, na je btw-aangifte.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={backup} disabled={!!backupMsg && !backupMsg.startsWith('Klaar') && !backupMsg.startsWith('Fout')}>
            Volledige back-up downloaden
          </Button>
          {backupMsg && <span className={`text-sm ${backupMsg.startsWith('Fout') ? 'text-red-600' : 'text-stone-600'}`}>{backupMsg}</span>}
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-1 text-sm font-medium">Google Drive</h2>
        {!GOOGLE_ENABLED ? (
          <p className="text-sm text-stone-500">Nog niet ingesteld: zet VITE_GOOGLE_CLIENT_ID in Vercel (zie README).</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Facturen gaan bij "Definitief maken" naar <i>facturenmap/Q1–Q4</i>. Bonnen sleep je in de bonnenmap; na verwerken gaan ze naar <i>bonnenmap/Verwerkt/jaar</i>.
            </p>
            {!connected && <Button onClick={connect}>Verbind met Google</Button>}
            {connected && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['invoices', 'Map voor facturen', s.drive_invoices_name],
                    ['receipts', 'Map voor nieuwe bonnen', s.drive_receipts_name],
                  ] as const
                ).map(([k, label, name]) => (
                  <Field key={k} label={label}>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">{name || 'Niet gekozen'}</span>
                      <Button onClick={() => setPick(k)}>Kies</Button>
                    </div>
                  </Field>
                ))}
              </div>
            )}
            {connected && s.drive_invoices_id && (
              <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
                <Button onClick={() => bulkDrive(false)} disabled={!!driveMsg && driveMsg.endsWith('…')}>
                  Ontbrekende facturen naar Drive
                </Button>
                <button className="text-xs text-stone-500 underline hover:text-ink" onClick={() => bulkDrive(true)}>
                  alles opnieuw
                </button>
                {driveMsg && <span className={`text-sm ${driveMsg.startsWith('Fout') ? 'text-red-600' : 'text-stone-600'}`}>{driveMsg}</span>}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-1 text-sm font-medium">E-mail (via je Gmail)</h2>
        <p className="mb-3 text-xs text-stone-500">Variabelen: {'{naam} {klant} {nummer} {bedrag} {vervaldatum} {factuurdatum} {opdracht} {po} {referentie} {iban}'} · {'{referentie}'} = PO-nummer, of anders de opdracht</p>
        <div className="space-y-3">
          {text('mail_bcc', 'Bcc (kopie aan jezelf)')}
          {text('mail_invoice_subject', 'Factuur · onderwerp')}
          {area('mail_invoice_body', 'Factuur · bericht')}
          {text('mail_quote_subject', 'Offerte · onderwerp')}
          {area('mail_quote_body', 'Offerte · bericht')}
          {text('mail_reminder_subject', 'Herinnering · onderwerp')}
          {area('mail_reminder_body', 'Herinnering · bericht', 8)}
        </div>
      </Card>
      {pick && (
        <FolderPicker title={pick === 'invoices' ? 'Map voor facturen' : 'Map voor nieuwe bonnen'} onPick={(f) => pickFolder(pick, f)} onClose={() => setPick(null)} />
      )}

      <p className="mt-4 text-xs text-stone-500">Prijzen van fotografie, video en apparatuur beheer je onder Producten.</p>
    </>
  )
}
