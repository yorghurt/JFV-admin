import { useMemo, useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { eur, fmtDate, quarterOf, round2, todayIso } from '../lib/calc'
import type { Parsed } from '../lib/ocr'
import { EXPENSE_CATEGORIES, type Expense } from '../lib/types'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { UploadDrop } from '../components/Upload'
import { PeriodPicker, usePeriod } from './Reports'

type Draft = Omit<Expense, 'id'> & { id?: string }
const blank = (): Draft => ({ date: todayIso(), supplier: '', description: '', category: 'Overig', amount_excl: 0, vat_amount: 0, total: 0, file_path: null })

/** Simpele categorie-suggestie op basis van leveranciersnaam/tekst. */
function guessCategory(text: string) {
  const t = text.toLowerCase()
  const rules: [RegExp, string][] = [
    [/adobe|google|microsoft|apple\.com|dropbox|spotify|lightroom|capture one|abonnement/, 'Software en abonnementen'],
    [/ns |ns\.nl|shell|bp |esso|tango|parkeer|q-park|uber|ov-chipkaart|tankstation/, 'Reiskosten en vervoer'],
    [/kpn|vodafone|t-mobile|odido|ziggo|simyo|tele2/, 'Telefoon en internet'],
    [/cameranu|kamera express|foto konijnenberg|canon|sony|nikon|fujifilm|coolblue|bol\.com/, 'Kleine aanschaffen (< €450)'],
    [/verzeker|insurance|centraal beheer|interpolis/, 'Verzekeringen'],
    [/bank|asn|ing |rabobank|abn amro|bunq/, 'Bankkosten'],
    [/meta|facebook|instagram|linkedin|drukwerk|vistaprint/, 'Marketing en reclame'],
    [/cursus|workshop|boek|training/, 'Opleiding en vakliteratuur'],
    [/studio|verhuur|rental/, 'Huur (studio, apparatuur)'],
  ]
  return rules.find(([re]) => re.test(t))?.[1] || 'Overig'
}

function ExpenseForm({ initial, onClose }: { initial?: Expense; onClose: () => void }) {
  const { reload } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [manual, setManual] = useState(!!initial)
  const [e, setE] = useState<Draft>(initial || blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof Draft, v: string | number) => setE((x) => ({ ...x, [k]: v }))

  function onParsed(p: Parsed, f: File) {
    setFile(f)
    setManual(true)
    const excl = p.excl ?? 0
    setE({
      ...blank(),
      date: p.date || todayIso(),
      supplier: p.supplier,
      description: p.number ? `Factuur ${p.number}` : '',
      category: guessCategory(p.text),
      amount_excl: excl,
      vat_amount: p.vat ?? 0,
      total: p.total ?? 0,
    })
  }

  // Bij wijzigen van totaal: btw 21% herberekenen
  const fromTotal = (total: number) => {
    const excl = round2(total / 1.21)
    setE((x) => ({ ...x, total, amount_excl: excl, vat_amount: round2(total - excl) }))
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const path = file ? await db.uploadFile(file, 'inkoop') : e.file_path
      await db.save('expenses', {
        ...e,
        amount_excl: round2(Number(e.amount_excl)),
        vat_amount: round2(Number(e.vat_amount)),
        total: round2(Number(e.total)),
        file_path: path,
      })
      await reload()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
    setBusy(false)
  }

  async function del() {
    if (!initial || !confirm('Uitgave verwijderen?')) return
    await db.remove('expenses', initial.id)
    await db.removeFile(initial.file_path)
    await reload()
    onClose()
  }

  async function openFile() {
    const url = e.file_path && (await db.fileUrl(e.file_path))
    if (url) window.open(url, '_blank')
  }

  return (
    <Modal title={initial ? 'Uitgave' : 'Nieuwe uitgave'} onClose={onClose}>
      {!manual ? (
        <div className="space-y-3">
          <UploadDrop onParsed={onParsed} />
          <button className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900" onClick={() => setManual(true)}>
            Handmatig invoeren zonder bestand
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {file && <p className="rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">Controleer de uitgelezen gegevens: {file.name}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <Input type="date" value={e.date} onChange={(x) => set('date', x.target.value)} />
            </Field>
            <Field label="Leverancier">
              <Input value={e.supplier} onChange={(x) => set('supplier', x.target.value)} />
            </Field>
          </div>
          <Field label="Omschrijving">
            <Input value={e.description} onChange={(x) => set('description', x.target.value)} />
          </Field>
          <Field label="Categorie">
            <Select value={e.category} onChange={(x) => set('category', x.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Totaal incl.">
              <Input type="number" step="0.01" value={e.total} onChange={(x) => fromTotal(Number(x.target.value))} />
            </Field>
            <Field label="Btw">
              <Input type="number" step="0.01" value={e.vat_amount} onChange={(x) => set('vat_amount', x.target.value)} />
            </Field>
            <Field label="Excl. btw">
              <Input type="number" step="0.01" value={e.amount_excl} onChange={(x) => set('amount_excl', x.target.value)} />
            </Field>
          </div>
          {round2(Number(e.amount_excl) + Number(e.vat_amount)) !== round2(Number(e.total)) && (
            <p className="text-xs text-amber-700">Let op: excl. + btw is niet gelijk aan het totaal.</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {initial && (
                <Button variant="danger" onClick={del}>
                  Verwijderen
                </Button>
              )}
              {e.file_path && <Button onClick={openFile}>Bestand</Button>}
            </div>
            <Button variant="primary" onClick={submit} disabled={busy}>
              Opslaan
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function Expenses() {
  const { expenses } = useStore()
  const period = usePeriod()
  const [edit, setEdit] = useState<Expense | 'new' | null>(null)

  const rows = useMemo(
    () =>
      expenses
        .filter((e) => Number(e.date.slice(0, 4)) === period.year && (!period.quarter || quarterOf(e.date) === period.quarter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, period.year, period.quarter],
  )
  const sum = rows.reduce((s, e) => s + Number(e.total), 0)

  return (
    <>
      <PageHeader title="Uitgaven" actions={<Button variant="primary" onClick={() => setEdit('new')}>+ Inkoopfactuur / bon</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PeriodPicker {...period} allowYear />
        <span className="text-sm text-neutral-500">
          Totaal: <span className="font-medium tabular text-neutral-900">{eur(sum)}</span>
        </span>
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>Geen uitgaven in deze periode.</Empty>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((e) => (
              <li key={e.id}>
                <button onClick={() => setEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                  <span className="w-20 shrink-0 text-xs text-neutral-500">{fmtDate(e.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.supplier || e.description || '—'}</span>
                    <span className="block truncate text-xs text-neutral-500">{e.category}</span>
                  </span>
                  {e.file_path && <span className="text-xs text-neutral-400" title="Bestand bijgevoegd">📎</span>}
                  <span className="text-sm font-medium tabular">{eur(e.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {edit && <ExpenseForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}
