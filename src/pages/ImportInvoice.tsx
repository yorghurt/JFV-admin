import { useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { blankDoc } from '../lib/docs'
import { round2, todayIso, addDays } from '../lib/calc'
import type { Parsed } from '../lib/ocr'
import { Button, Field, Input, Modal, Select } from '../components/ui'
import { UploadDrop } from '../components/Upload'

/** Bestaande (oude) verkoopfactuur uploaden: telt mee in omzet en btw, nummering loopt daarna door. */
export function ImportInvoice({ onClose }: { onClose: () => void }) {
  const { settings, clients, docs, reload } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [f, setF] = useState({ number: '', date: todayIso(), client: '', excl: 0, vat: 0, total: 0, status: 'betaald' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }))

  function onParsed(p: Parsed, file: File) {
    setFile(file)
    setF({
      number: p.number,
      date: p.date || todayIso(),
      client: p.supplier,
      excl: p.excl ?? 0,
      vat: p.vat ?? 0,
      total: p.total ?? 0,
      status: 'betaald',
    })
  }

  async function submit() {
    setError('')
    if (!f.number) return setError('Factuurnummer is verplicht.')
    if (docs.some((d) => d.doc_type === 'factuur' && d.number === f.number)) return setError('Dit factuurnummer bestaat al.')
    setBusy(true)
    try {
      const path = file ? await db.uploadFile(file, 'verkoop') : null
      const client = clients.find((c) => c.name.toLowerCase() === f.client.toLowerCase())
      await db.save('documents', {
        ...blankDoc('factuur', settings),
        number: f.number.trim(),
        status: f.status,
        issue_date: f.date,
        due_date: addDays(f.date, settings.payment_days),
        client_id: client?.id || null,
        client_snapshot: client ? { name: client.name } : { name: f.client },
        subtotal: round2(Number(f.excl)),
        vat_amount: round2(Number(f.vat)),
        total: round2(Number(f.total)),
        imported: true,
        file_path: path,
        paid_at: f.status === 'betaald' ? f.date : null,
      })
      await reload()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Modal title="Bestaande factuur importeren" onClose={onClose}>
      {!file ? (
        <UploadDrop onParsed={onParsed} />
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">Controleer de uitgelezen gegevens: {file.name}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Factuurnummer">
              <Input value={f.number} onChange={(e) => set('number', e.target.value)} />
            </Field>
            <Field label="Factuurdatum">
              <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          </div>
          <Field label="Klant">
            <Input list="clients" value={f.client} onChange={(e) => set('client', e.target.value)} />
            <datalist id="clients">
              {clients.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Bedrag excl.">
              <Input type="number" step="0.01" value={f.excl} onChange={(e) => set('excl', e.target.value)} />
            </Field>
            <Field label="Btw">
              <Input type="number" step="0.01" value={f.vat} onChange={(e) => set('vat', e.target.value)} />
            </Field>
            <Field label="Totaal">
              <Input type="number" step="0.01" value={f.total} onChange={(e) => set('total', e.target.value)} />
            </Field>
          </div>
          {round2(Number(f.excl) + Number(f.vat)) !== round2(Number(f.total)) && (
            <p className="text-xs text-amber-700">Let op: excl. + btw is niet gelijk aan het totaal.</p>
          )}
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="betaald">Betaald</option>
              <option value="verzonden">Openstaand</option>
            </Select>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setFile(null)}>Ander bestand</Button>
            <Button variant="primary" onClick={submit} disabled={busy}>
              Opslaan
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
