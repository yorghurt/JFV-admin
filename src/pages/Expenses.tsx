import { useEffect, useMemo, useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { eur, fmtDate, quarterOf, round2, todayIso } from '../lib/calc'
import type { Parsed } from '../lib/ocr'
import { EXPENSE_CATEGORIES, type Expense } from '../lib/types'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { QueueStatus, UploadDrop, useFileQueue } from '../components/Upload'
import { matchSupplier } from '../lib/suppliers'
import { PeriodPicker, usePeriod } from './Reports'

type Draft = Omit<Expense, 'id'> & { id?: string }
const blank = (): Draft => ({ date: todayIso(), supplier: '', description: '', category: 'Overig', amount_excl: 0, vat_amount: 0, total: 0, file_path: null })

export function draftFromParsed(p: Parsed, history: Expense[]): Draft {
  const m = matchSupplier(p.text, history)
  return {
    ...blank(),
    date: p.date || todayIso(),
    supplier: m?.name || p.supplier,
    description: p.number ? `Factuur ${p.number}` : '',
    category: m?.category || 'Overig',
    amount_excl: p.excl ?? 0,
    vat_amount: p.vat ?? 0,
    total: p.total ?? 0,
  }
}

function ExpenseForm({
  initial,
  files,
  onFileSaved,
  onClose,
}: {
  initial?: Expense
  files?: File[]
  onFileSaved?: (file: File, e: Draft) => Promise<void>
  onClose: () => void
}) {
  const { reload, expenses } = useStore()
  const q = useFileQueue()
  useEffect(() => {
    if (files?.length) q.start(files)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [manual, setManual] = useState(!!initial)
  const [e, setE] = useState<Draft>(initial || blank())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(0)
  const set = (k: keyof Draft, v: string | number) => setE((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (q.parsed) setE(draftFromParsed(q.parsed, expenses))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.parsed])

  // Bij wijzigen van totaal: btw 21% herberekenen
  const fromTotal = (total: number) => {
    const excl = round2(total / 1.21)
    setE((x) => ({ ...x, total, amount_excl: excl, vat_amount: round2(total - excl) }))
  }

  function advance() {
    if (q.count && !q.isLast) q.next()
    else onClose()
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const path = q.file ? await db.uploadFile(q.file, 'inkoop') : e.file_path
      await db.save('expenses', {
        ...e,
        amount_excl: round2(Number(e.amount_excl)),
        vat_amount: round2(Number(e.vat_amount)),
        total: round2(Number(e.total)),
        file_path: path,
      })
      if (q.file && onFileSaved) await onFileSaved(q.file, e)
      await reload()
      setSaved((n) => n + 1)
      advance()
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

  const title = initial ? 'Uitgave' : q.count > 1 ? `Uitgave ${q.index + 1} van ${q.count}` : 'Nieuwe uitgave'

  return (
    <Modal title={title} onClose={onClose}>
      {!manual && !q.count ? (
        <div className="space-y-3">
          <UploadDrop onFiles={q.start} />
          <button className="w-full text-center text-sm text-stone-500 hover:text-ink" onClick={() => setManual(true)}>
            Handmatig invoeren zonder bestand
          </button>
        </div>
      ) : q.count && !q.parsed ? (
        <QueueStatus index={q.index} count={q.count} progress={q.progress} name={q.file?.name} />
      ) : (
        <div className="space-y-3">
          {q.file && (
            <p className="rounded-lg bg-stone-50 p-2 text-xs text-stone-600">
              Controleer de uitgelezen gegevens: {q.file.name}
              {saved > 0 && ` · ${saved} opgeslagen`}
            </p>
          )}
          {(error || q.error) && <p className="text-sm text-red-600">{error || q.error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <Input type="date" value={e.date} onChange={(x) => set('date', x.target.value)} />
            </Field>
            <Field label="Leverancier">
              <Input list="suppliers" value={e.supplier} onChange={(x) => set('supplier', x.target.value)} />
              <datalist id="suppliers">
                {[...new Set(expenses.map((x) => x.supplier).filter(Boolean))].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
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
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {initial && (
                <Button variant="danger" onClick={del}>
                  Verwijderen
                </Button>
              )}
              {e.file_path && <Button onClick={openFile}>Bestand</Button>}
              {q.count > 1 && (
                <Button variant="ghost" onClick={advance} disabled={busy}>
                  Overslaan
                </Button>
              )}
            </div>
            <Button variant="primary" onClick={submit} disabled={busy}>
              {q.count > 1 && !q.isLast ? 'Opslaan en volgende →' : 'Opslaan'}
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
  const { settings } = useStore()
  const [drive, setDrive] = useState<{ files: File[]; ids: Map<File, string> } | null>(null)
  const [driveMsg, setDriveMsg] = useState('')

  async function fromDrive() {
    setDriveMsg('Google Drive controleren…')
    try {
      const g = await import('../lib/google')
      const items = await g.listDocuments(settings.drive_receipts_id)
      if (!items.length) return setDriveMsg('Geen nieuwe bonnen in Google Drive.')
      const ids = new Map<File, string>()
      const files: File[] = []
      for (const [i, it] of items.entries()) {
        setDriveMsg(`Downloaden ${i + 1} van ${items.length}…`)
        const f = await g.downloadFromDrive(it)
        ids.set(f, it.id)
        files.push(f)
      }
      setDriveMsg('')
      setDrive({ files, ids })
    } catch (e) {
      setDriveMsg('Fout: ' + (e as Error).message)
    }
  }

  /** Verwerkte bon in Drive verplaatsen naar <bonnenmap>/Verwerkt/<jaar>. */
  async function archive(file: File, e: { date: string }) {
    const id = drive?.ids.get(file)
    if (!id) return
    const g = await import('../lib/google')
    const target = await g.ensurePath(['Verwerkt', e.date.slice(0, 4)], settings.drive_receipts_id)
    await g.moveFile(id, settings.drive_receipts_id, target)
  }

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
      <PageHeader
        title="Uitgaven"
        actions={
          <>
            {settings.drive_receipts_id && <Button onClick={fromDrive}>Bonnen uit Google Drive</Button>}
            <Button variant="primary" onClick={() => setEdit('new')}>
              + Inkoopfactuur / bon
            </Button>
          </>
        }
      />
      {driveMsg && <p className={`mb-3 text-sm ${driveMsg.startsWith('Fout') ? 'text-red-600' : 'text-stone-600'}`}>{driveMsg}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PeriodPicker {...period} allowYear />
        <span className="text-sm text-stone-500">
          Totaal: <span className="font-medium tabular text-ink">{eur(sum)}</span>
        </span>
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>Geen uitgaven in deze periode.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((e) => (
              <li key={e.id}>
                <button onClick={() => setEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                  <span className="w-20 shrink-0 text-xs text-stone-500">{fmtDate(e.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.supplier || e.description || '—'}</span>
                    <span className="block truncate text-xs text-stone-500">{e.category}</span>
                  </span>
                  {e.file_path && <span className="text-xs text-stone-400" title="Bestand bijgevoegd">📎</span>}
                  <span className="text-sm font-medium tabular">{eur(e.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {edit && <ExpenseForm initial={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {drive && <ExpenseForm files={drive.files} onFileSaved={archive} onClose={() => setDrive(null)} />}
    </>
  )
}
