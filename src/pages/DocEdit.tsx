import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { addDays, eur, fmtDate, isOverdue, lineTotal, todayIso, totals, uid } from '../lib/calc'
import { blankDoc, convertQuote, createCredit, downloadPdf, finalizeInvoice, nextQuoteNumber, settleCredit, snapshot, withTotals } from '../lib/docs'
import { Link } from 'react-router-dom'
import { MailModal } from '../components/MailModal'
import { saveToDrive, type MailKind } from '../lib/docs'
import { KIND_LABEL, type Doc, type DocType, type Kind, type Line } from '../lib/types'
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../components/ui'
import { ClientForm } from './Clients'
import { displayStatus } from './DocList'

export function DocEdit({ type }: { type: DocType }) {
  const { id } = useParams()
  const nav = useNavigate()
  const store = useStore()
  const { settings, clients, products, docs, reload } = store
  const base = type === 'factuur' ? '/facturen' : '/offertes'
  const existing = docs.find((d) => d.id === id)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [newClient, setNewClient] = useState(false)
  const [mail, setMail] = useState<MailKind | null>(null)

  useEffect(() => {
    if (id === 'nieuw') setDoc({ ...blankDoc(type, settings), id: '' } as Doc)
    else if (existing) setDoc(structuredClone(existing))
  }, [id, existing, type, settings])

  const t = useMemo(() => (doc ? totals(doc.lines, doc.vat_rate) : { subtotal: 0, vat: 0, total: 0 }), [doc])

  if (store.loading) return null
  if (!doc) return <p className="text-sm text-stone-500">Niet gevonden.</p>

  const update = (patch: Partial<Doc>) => {
    setDoc((d) => ({ ...d!, ...patch }))
    setDirty(true)
  }
  const updateLine = (lid: string, patch: Partial<Line>) => update({ lines: doc.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) })

  function addLine(productId: string) {
    const p = products.find((x) => x.id === productId)
    const line: Line = {
      id: uid(),
      kind: p?.kind || null,
      product_id: p?.id || null,
      date: p ? doc!.issue_date : null,
      description: p ? p.name + (p.description ? ` — ${p.description}` : '') : '',
      quantity: 1,
      unit: p?.unit || 'dagdeel',
      price: p?.price || 0,
    }
    const patch: Partial<Doc> = { lines: [...doc!.lines, line] }
    if (p?.kind === 'apparatuur' && !doc!.note) {
      patch.note = settings.rental_note
      patch.show_rental_link = !!settings.rental_list_url
    }
    update(patch)
  }

  async function persist(d: Doc = doc!) {
    const row = withTotals({ ...d }) as Partial<Doc>
    if (!row.id) {
      delete row.id
      if (type === 'offerte') row.number = nextQuoteNumber(docs, d.issue_date)
    }
    const saved = await db.save('documents', row as Doc)
    await reload()
    setDirty(false)
    return saved as Doc
  }

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      if (ok) setMsg(ok)
    } catch (e) {
      setMsg('Fout: ' + (e as Error).message)
    }
    setBusy(false)
  }

  const onSave = () =>
    run(async () => {
      const saved = await persist()
      if (!doc.id) nav(`${base}/${saved.id}`, { replace: true })
    }, 'Opgeslagen')

  async function finalize(d: Doc) {
    const fresh = (await finalizeInvoice(d, docs)) as Doc
    if (fresh.credit_of) await settleCredit(fresh, docs)
    await reload()
    return fresh
  }

  /** PDF naar Google Drive; fouten melden zonder de rest te blokkeren. */
  async function driveNote(d: Doc) {
    if (!settings.drive_invoices_id) return ''
    try {
      await saveToDrive(withTotals(d), settings, docs.find((x) => x.id === d.credit_of)?.number)
      return ' en opgeslagen in Google Drive'
    } catch (e) {
      return ` (Drive: ${(e as Error).message})`
    }
  }

  /** Voor het mailen: opslaan en bij een concept-factuur eerst definitief maken. */
  async function prepareMail(): Promise<Doc> {
    if (isInvoice && doc!.status === 'concept') {
      if (!doc!.client_snapshot.name) throw new Error('Kies eerst een klant.')
      if (!doc!.lines.length) throw new Error('Voeg minimaal één regel toe.')
      const fresh = await finalize(await persist())
      await driveNote(fresh)
      return withTotals(fresh) as Doc
    }
    return withTotals(dirty || !doc!.id ? await persist() : doc!) as Doc
  }

  async function afterMail(sent: Doc, to: string) {
    const now = new Date().toISOString()
    const patch: Partial<Doc> = mail === 'reminder' ? { reminded_at: now } : { sent_at: now }
    if (!isInvoice && sent.status === 'concept') patch.status = 'verzonden'
    await db.save('documents', { ...sent, ...patch })
    const client = clients.find((c) => c.id === sent.client_id)
    if (client && !client.email) await db.save('clients', { ...client, email: to })
    await reload()
    if (sent.id !== doc!.id) nav(`${base}/${sent.id}`, { replace: true })
    setMsg(mail === 'reminder' ? `Herinnering verstuurd naar ${to}` : `Verstuurd naar ${to}`)
  }

  const onFinalize = () =>
    run(async () => {
      if (!doc.client_snapshot.name) throw new Error('Kies eerst een klant.')
      if (!doc.lines.length) throw new Error('Voeg minimaal één regel toe.')
      const saved = await persist()
      const fresh = await finalize(saved)
      nav(`${base}/${fresh.id}`, { replace: true })
      setMsg('Factuur definitief gemaakt' + (await driveNote(fresh)))
    })

  const onPdf = () =>
    run(async () => {
      const saved = dirty || !doc.id ? await persist() : doc
      if (!doc.id) nav(`${base}/${saved.id}`, { replace: true })
      await downloadPdf(withTotals(saved), settings, docs.find((d) => d.id === saved.credit_of)?.number)
    })

  const onStatus = (status: string) =>
    run(async () => {
      await persist({ ...doc, status, paid_at: status === 'betaald' ? todayIso() : null })
    })

  const onConvert = () =>
    run(async () => {
      const saved = await persist()
      const inv = await convertQuote(withTotals(saved), settings)
      await reload()
      nav(`/facturen/${inv.id}`)
    })

  const onCredit = () =>
    run(async () => {
      if (!confirm(`Creditfactuur maken voor factuur ${doc.number}?`)) return
      const c = await createCredit(doc, settings)
      await reload()
      nav(`/facturen/${c.id}`)
    })

  const onDelete = () =>
    run(async () => {
      if (!confirm('Verwijderen?')) return
      if (doc.id) await db.remove('documents', doc.id)
      await db.removeFile(doc.file_path)
      await reload()
      nav(base)
    })

  const isInvoice = type === 'factuur'
  const isCredit = !!doc.credit_of
  const label = isCredit ? 'Creditfactuur' : isInvoice ? 'Factuur' : 'Offerte'
  const title = doc.id ? `${label} ${doc.number || '(concept)'}` : `Nieuwe ${type}`
  const credited = docs.find((d) => d.id === doc.credit_of)
  const credits = docs.filter((d) => d.credit_of && d.credit_of === doc.id)
  const canCredit = isInvoice && !isCredit && doc.id && ['verzonden', 'betaald'].includes(doc.status)
  const canDelete = doc.status === 'concept' || doc.imported || !isInvoice
  const sourceQuote = doc.source_quote_id && docs.find((d) => d.id === doc.source_quote_id)
  const productsByKind = (['fotografie', 'video', 'apparatuur'] as Kind[]).map((k) => [k, products.filter((p) => p.kind === k && p.active)] as const)

  if (doc.imported) return <ImportedView doc={doc} onStatus={onStatus} onDelete={onDelete} onCredit={canCredit ? onCredit : undefined} busy={busy} />

  return (
    <>
      <PageHeader
        title={title}
        actions={
          <>
            {doc.id && <Badge status={displayStatus(doc)} />}
            <Button onClick={onPdf} disabled={busy}>
              PDF
            </Button>
            {(doc.status === 'concept' || doc.status === 'verzonden' || !isInvoice) && (
              <Button onClick={() => setMail(isInvoice ? 'invoice' : 'quote')} disabled={busy}>
                Mailen
              </Button>
            )}
            {isOverdue(doc) && (
              <Button variant="accent" onClick={() => setMail('reminder')} disabled={busy}>
                Herinnering
              </Button>
            )}
            <Button onClick={onSave} disabled={busy}>
              Opslaan
            </Button>
            {isInvoice && doc.status === 'concept' && (
              <Button variant="primary" onClick={onFinalize} disabled={busy}>
                Definitief maken
              </Button>
            )}
            {isInvoice && doc.status === 'verzonden' && (
              <Button variant="primary" onClick={() => onStatus('betaald')} disabled={busy}>
                {isCredit ? 'Markeer als terugbetaald' : 'Markeer als betaald'}
              </Button>
            )}
            {canCredit && (
              <Button onClick={onCredit} disabled={busy}>
                Creditfactuur
              </Button>
            )}
            {isInvoice && doc.status === 'betaald' && (
              <Button onClick={() => onStatus('verzonden')} disabled={busy}>
                Toch niet betaald
              </Button>
            )}
            {!isInvoice && doc.id && doc.status !== 'geaccepteerd' && (
              <Button variant="primary" onClick={onConvert} disabled={busy}>
                Omzetten naar factuur
              </Button>
            )}
          </>
        }
      />

      {isOverdue(doc) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Vervaldatum ({fmtDate(doc.due_date)}) is verstreken. Check je rekening of de betaling binnen is.
        </div>
      )}
      {msg && <p className={`mb-3 text-sm ${msg.startsWith('Fout') ? 'text-red-600' : 'text-green-700'}`}>{msg}</p>}
      {(doc.sent_at || doc.reminded_at) && (
        <p className="mb-3 text-xs text-stone-500">
          {doc.sent_at && `Gemaild op ${fmtDate(doc.sent_at)}`}
          {doc.sent_at && doc.reminded_at && ' · '}
          {doc.reminded_at && `Herinnering op ${fmtDate(doc.reminded_at)}`}
        </p>
      )}
      {sourceQuote && <p className="mb-3 text-xs text-stone-500">Aangemaakt vanuit offerte {sourceQuote.number}</p>}
      {credited && (
        <p className="mb-3 rounded-lg bg-brand-light p-3 text-sm">
          Creditfactuur voor{' '}
          <Link className="underline" to={`/facturen/${credited.id}`}>
            factuur {credited.number}
          </Link>
          . Bedragen zijn negatief. Pas regels aan voor een gedeeltelijke creditering.
        </p>
      )}
      {credits.length > 0 && (
        <p className="mb-3 text-xs text-stone-500">
          Gecrediteerd met:{' '}
          {credits.map((c) => (
            <Link key={c.id} className="mr-2 underline" to={`/facturen/${c.id}`}>
              {c.number || 'concept'}
            </Link>
          ))}
        </p>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Klant">
            <div className="flex gap-2">
              <Select
                value={doc.client_id || ''}
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value)
                  update({ client_id: c?.id || null, client_snapshot: snapshot(c) })
                }}
              >
                <option value="">Kies klant…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button type="button" onClick={() => setNewClient(true)} title="Nieuwe klant">
                +
              </Button>
            </div>
          </Field>
          <Field label="Opdrachtnaam">
            <Input value={doc.project_name} onChange={(e) => update({ project_name: e.target.value })} placeholder="Bijv. Apparatuur - WML" />
          </Field>
          <Field label={isInvoice ? 'Factuurdatum' : 'Offertedatum'}>
            <Input
              type="date"
              value={doc.issue_date}
              onChange={(e) =>
                update({
                  issue_date: e.target.value,
                  due_date: addDays(e.target.value, isInvoice ? settings.payment_days : settings.quote_valid_days),
                })
              }
            />
          </Field>
          <Field label={isInvoice ? 'Vervaldatum' : 'Geldig tot'}>
            <Input type="date" value={doc.due_date || ''} onChange={(e) => update({ due_date: e.target.value })} />
          </Field>
          <Field label="PO-nummer (optioneel)">
            <Input value={doc.po_number} onChange={(e) => update({ po_number: e.target.value })} />
          </Field>
          {!isInvoice && doc.id && (
            <Field label="Status">
              <Select value={doc.status} onChange={(e) => update({ status: e.target.value })}>
                {['concept', 'verzonden', 'geaccepteerd', 'afgewezen'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="hidden grid-cols-[1fr_8rem_5rem_6rem_6rem_2rem] gap-2 border-b border-stone-100 px-4 py-2 text-xs font-medium text-stone-500 sm:grid">
          <span>Omschrijving</span>
          <span>Datum</span>
          <span>Aantal</span>
          <span>Prijs</span>
          <span className="text-right">Totaal</span>
          <span />
        </div>
        {doc.lines.map((l) => (
          <div key={l.id} className="grid grid-cols-2 gap-2 border-b border-stone-100 px-4 py-3 sm:grid-cols-[1fr_8rem_5rem_6rem_6rem_2rem] sm:items-center">
            <div className="col-span-2 sm:col-span-1">
              {l.kind && <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-stone-400">{KIND_LABEL[l.kind]}</span>}
              <Input value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} placeholder="Omschrijving" />
            </div>
            <Input type="date" value={l.date || ''} onChange={(e) => updateLine(l.id, { date: e.target.value || null })} />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.5"
                min={l.kind === 'apparatuur' ? 0.5 : 0}
                value={l.quantity}
                onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })}
                onBlur={() => l.kind === 'apparatuur' && l.quantity < 0.5 && updateLine(l.id, { quantity: 0.5 })}
              />
              <span className="text-xs text-stone-400">{l.unit === 'dag' ? 'dag' : 'dd'}</span>
            </div>
            <Input type="number" step="0.01" value={l.price} onChange={(e) => updateLine(l.id, { price: Number(e.target.value) })} />
            <span className="text-right text-sm tabular">{eur(lineTotal(l))}</span>
            <button onClick={() => update({ lines: doc.lines.filter((x) => x.id !== l.id) })} className="text-right text-stone-400 hover:text-red-600" aria-label="Verwijder regel">
              ✕
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <Select className="w-auto" value="" onChange={(e) => e.target.value && addLine(e.target.value === '_vrij' ? '' : e.target.value)}>
            <option value="">+ Regel toevoegen…</option>
            {productsByKind.map(([k, ps]) =>
              ps.length ? (
                <optgroup key={k} label={KIND_LABEL[k]}>
                  {ps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {eur(p.price)} / {p.unit}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
            <option value="_vrij">Vrije regel</option>
          </Select>
          {products.length === 0 && <span className="text-xs text-stone-500">Tip: voeg producten toe onder Producten.</span>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-[1fr_18rem]">
        <Card className="p-4">
          <Field label="Toelichting (op factuur)">
            <Textarea rows={4} value={doc.note} onChange={(e) => update({ note: e.target.value })} />
          </Field>
          <label className="mt-2 flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={doc.show_rental_link} onChange={(e) => update({ show_rental_link: e.target.checked })} />
            Link "Verhuurlijst" tonen
            {!settings.rental_list_url && <span className="text-xs text-amber-700">(stel URL in bij Instellingen)</span>}
          </label>
        </Card>
        <Card className="space-y-2 p-4 text-sm tabular">
          <div className="flex justify-between">
            <span className="text-stone-500">Subtotaal</span>
            <span>{eur(t.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Btw ({doc.vat_rate}%)</span>
            <span>{eur(t.vat)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-semibold">
            <span>Totaal</span>
            <span>{eur(t.total)}</span>
          </div>
        </Card>
      </div>

      {canDelete && doc.id && (
        <div className="mt-6">
          <Button variant="danger" onClick={onDelete}>
            Verwijderen
          </Button>
        </div>
      )}

      {mail && (
        <MailModal
          doc={withTotals(doc) as Doc}
          kind={mail}
          settings={settings}
          creditedNumber={credited ? credited.number : null}
          prepare={prepareMail}
          onSent={afterMail}
          onClose={() => setMail(null)}
        />
      )}
      {newClient && (
        <ClientForm
          onClose={() => setNewClient(false)}
          onSaved={(c) => {
            update({ client_id: c.id, client_snapshot: snapshot(c) })
            setNewClient(false)
          }}
        />
      )}
    </>
  )
}

function ImportedView({ doc, onStatus, onDelete, onCredit, busy }: { doc: Doc; onStatus: (s: string) => void; onDelete: () => void; onCredit?: () => void; busy: boolean }) {
  async function open() {
    const url = doc.file_path && (await db.fileUrl(doc.file_path))
    if (url) window.open(url, '_blank')
  }
  return (
    <>
      <PageHeader title={`Factuur ${doc.number}`} actions={<Badge status={displayStatus(doc)} />} />
      {isOverdue(doc) && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Vervaldatum is verstreken. Check je rekening of de betaling binnen is.</div>
      )}
      <Card className="space-y-2 p-4 text-sm">
        <p className="text-xs text-stone-500">Geïmporteerde factuur</p>
        <Row k="Klant" v={doc.client_snapshot.name || ''} />
        <Row k="Factuurdatum" v={fmtDate(doc.issue_date)} />
        <Row k="Bedrag excl." v={eur(doc.subtotal)} />
        <Row k="Btw" v={eur(doc.vat_amount)} />
        <Row k="Totaal" v={eur(doc.total)} />
        <div className="flex flex-wrap gap-2 pt-3">
          {doc.file_path && <Button onClick={open}>Origineel bekijken</Button>}
          {onCredit && <Button onClick={onCredit}>Creditfactuur</Button>}
          {doc.status === 'verzonden' ? (
            <Button variant="primary" disabled={busy} onClick={() => onStatus('betaald')}>
              Markeer als betaald
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => onStatus('verzonden')}>
              Markeer als openstaand
            </Button>
          )}
          <Button variant="danger" onClick={onDelete}>
            Verwijderen
          </Button>
        </div>
      </Card>
    </>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between">
    <span className="text-stone-500">{k}</span>
    <span className="tabular">{v}</span>
  </div>
)
