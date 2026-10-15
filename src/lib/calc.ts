import type { Doc, Expense, Line } from './types'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function lineTotal(l: Line) {
  return round2((Number(l.quantity) || 0) * (Number(l.price) || 0))
}

export function totals(lines: Line[], vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + lineTotal(l), 0))
  const vat = round2((subtotal * vatRate) / 100)
  return { subtotal, vat, total: round2(subtotal + vat) }
}

const nf = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(Number(n) || 0)
export const eur = (n: number) => `€ ${num(n)}`

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function quarterOf(iso: string) {
  return Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1
}

/** Volgend nummer: jaar + volgnummer (2 cijfers, groeit mee). Teller start elk jaar op 01. */
export function nextNumber(existing: (string | null)[], year: number, suffix = '') {
  let max = 0
  for (const n of existing) {
    if (!n) continue
    const base = suffix ? n.replace(new RegExp(`${suffix}$`), '') : n
    if (suffix && base === n) continue
    if (!/^\d+$/.test(base) || !base.startsWith(String(year))) continue
    const seq = Number(base.slice(4))
    if (seq > max) max = seq
  }
  return `${year}${String(max + 1).padStart(2, '0')}${suffix}`
}

export function isOverdue(d: Doc, today = todayIso()) {
  return d.doc_type === 'factuur' && d.status === 'verzonden' && !!d.due_date && d.due_date < today
}

export interface Period {
  revenue: number
  vatOut: number
  costs: number
  vatIn: number
  invoices: Doc[]
  expenses: Expense[]
}

/** Factuurstelsel: omzet telt op factuurdatum. Concepten tellen niet mee. */
export function periodSummary(docs: Doc[], expenses: Expense[], year: number, quarter?: number): Period {
  const inPeriod = (iso: string) =>
    Number(iso.slice(0, 4)) === year && (!quarter || quarterOf(iso) === quarter)
  const invoices = docs.filter(
    (d) => d.doc_type === 'factuur' && d.status !== 'concept' && inPeriod(d.issue_date),
  )
  const exps = expenses.filter((e) => inPeriod(e.date))
  return {
    revenue: round2(invoices.reduce((s, d) => s + Number(d.subtotal), 0)),
    vatOut: round2(invoices.reduce((s, d) => s + Number(d.vat_amount), 0)),
    costs: round2(exps.reduce((s, e) => s + Number(e.amount_excl), 0)),
    vatIn: round2(exps.reduce((s, e) => s + Number(e.vat_amount), 0)),
    invoices,
    expenses: exps,
  }
}

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = typeof c === 'number' ? num(c) : String(c ?? '')
          return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\n')
}

export function download(name: string, data: Blob | string, type = 'text/csv;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob(['﻿' + data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const uid = () => crypto.randomUUID()
