import { addDays, download, nextNumber, todayIso, totals, uid } from './calc'
import * as db from './db'
import type { Client, Doc, DocType, Settings } from './types'

export function blankDoc(type: DocType, settings: Settings): Omit<Doc, 'id'> & { id?: string } {
  const issue = todayIso()
  return {
    doc_type: type,
    number: null,
    status: 'concept',
    client_id: null,
    client_snapshot: {},
    issue_date: issue,
    due_date: addDays(issue, type === 'factuur' ? settings.payment_days : settings.quote_valid_days),
    project_name: '',
    po_number: '',
    note: '',
    show_rental_link: false,
    lines: [],
    vat_rate: 21,
    subtotal: 0,
    vat_amount: 0,
    total: 0,
    imported: false,
    file_path: null,
    source_quote_id: null,
    credit_of: null,
    paid_at: null,
  }
}

export function snapshot(c: Client | undefined): Partial<Client> {
  if (!c) return {}
  const { name, contact, address, postal_city, email } = c
  return { name, contact, address, postal_city, email }
}

export function withTotals<T extends Pick<Doc, 'lines' | 'vat_rate'>>(d: T) {
  const t = totals(d.lines, d.vat_rate)
  return { ...d, subtotal: t.subtotal, vat_amount: t.vat, total: t.total }
}

export function nextInvoiceNumber(docs: Doc[], issueDate: string) {
  return nextNumber(docs.filter((d) => d.doc_type === 'factuur').map((d) => d.number), Number(issueDate.slice(0, 4)))
}

export function nextQuoteNumber(docs: Doc[], issueDate: string) {
  return nextNumber(docs.filter((d) => d.doc_type === 'offerte').map((d) => d.number), Number(issueDate.slice(0, 4)), '-O')
}

/** Factuur definitief maken: krijgt het eerstvolgende nummer en status verzonden. */
export async function finalizeInvoice(doc: Doc, docs: Doc[]) {
  return db.save('documents', withTotals({ ...doc, number: doc.number || nextInvoiceNumber(docs, doc.issue_date), status: 'verzonden' }))
}

export async function convertQuote(quote: Doc, settings: Settings) {
  const issue = todayIso()
  const inv = await db.save('documents', {
    ...blankDoc('factuur', settings),
    client_id: quote.client_id,
    client_snapshot: quote.client_snapshot,
    project_name: quote.project_name,
    po_number: quote.po_number,
    note: quote.note,
    show_rental_link: quote.show_rental_link,
    lines: quote.lines.map((l) => ({ ...l, id: uid() })),
    vat_rate: quote.vat_rate,
    subtotal: quote.subtotal,
    vat_amount: quote.vat_amount,
    total: quote.total,
    issue_date: issue,
    due_date: addDays(issue, settings.payment_days),
    source_quote_id: quote.id,
  })
  await db.save('documents', { ...quote, status: 'geaccepteerd' })
  return inv
}

/** Creditfactuur: kopie met negatieve bedragen, zelfde nummerreeks (krijgt nummer bij definitief maken). */
export async function createCredit(inv: Doc, settings: Settings) {
  const issue = todayIso()
  const lines = inv.lines.length
    ? inv.lines.map((l) => ({ ...l, id: uid(), price: -Math.abs(Number(l.price)) }))
    : [{ id: uid(), kind: null, product_id: null, date: null, description: `Creditering factuur ${inv.number}`, quantity: 1, unit: 'dag' as const, price: -Math.abs(Number(inv.subtotal)) }]
  return db.save(
    'documents',
    withTotals({
      ...blankDoc('factuur', settings),
      client_id: inv.client_id,
      client_snapshot: inv.client_snapshot,
      project_name: inv.project_name,
      po_number: inv.po_number,
      lines,
      vat_rate: inv.vat_rate,
      issue_date: issue,
      due_date: issue,
      credit_of: inv.id,
    }),
  )
}

/** Na definitief maken van een creditfactuur: bij volledige creditering origineel op 'gecrediteerd'. */
export async function settleCredit(credit: Doc, docs: Doc[]) {
  const orig = docs.find((d) => d.id === credit.credit_of)
  if (!orig) return
  const full = Math.abs(Number(credit.total) + Number(orig.total)) < 0.01
  if (!full) return
  const wasPaid = orig.status === 'betaald'
  await db.save('documents', { ...orig, status: 'gecrediteerd' })
  // Onbetaalde factuur volledig gecrediteerd: niets terug te betalen → credit direct verrekend
  if (!wasPaid) await db.save('documents', { ...credit, status: 'betaald', paid_at: todayIso() })
}

export async function downloadPdf(doc: Doc, settings: Settings, creditedNumber?: string | null) {
  const [{ pdf }, { InvoicePdf }] = await Promise.all([import('@react-pdf/renderer'), import('../pdf/InvoicePdf')])
  const blob = await pdf(<InvoicePdf doc={doc} settings={settings} creditedNumber={creditedNumber} />).toBlob()
  const kind = doc.doc_type === 'offerte' ? 'Offerte' : doc.credit_of ? 'Creditfactuur' : 'Factuur'
  const client = (doc.client_snapshot.name || '').split(' ')[0]
  download(`${kind} ${doc.number || 'concept'}${client ? ' ' + client : ''}.pdf`, blob)
}
