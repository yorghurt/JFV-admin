import { fmtDate, toCsv, todayIso } from './calc'
import * as db from './db'
import { pdfBlob, pdfFileName } from './docs'
import type { Client, Doc, Expense, Product, Settings } from './types'

interface Data {
  settings: Settings
  clients: Client[]
  products: Product[]
  docs: Doc[]
  expenses: Expense[]
}

/**
 * Volledige back-up als zip: alle gegevens (JSON + CSV), alle geüploade bestanden
 * (bonnen, geïmporteerde facturen) en een PDF van elke zelfgemaakte factuur/offerte.
 */
export async function buildBackup(d: Data, onProgress: (msg: string) => void): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2))

  files['gegevens/instellingen.json'] = json(d.settings)
  files['gegevens/klanten.json'] = json(d.clients)
  files['gegevens/producten.json'] = json(d.products)
  files['gegevens/facturen-en-offertes.json'] = json(d.docs)
  files['gegevens/uitgaven.json'] = json(d.expenses)

  const sorted = [...d.docs].sort((a, b) => (a.number || '').localeCompare(b.number || ''))
  files['facturen.csv'] = strToU8(
    '﻿' +
      toCsv([
        ['Soort', 'Nummer', 'Datum', 'Klant', 'Opdracht', 'Excl. btw', 'Btw', 'Totaal', 'Status'],
        ...sorted.map((x) => [x.credit_of ? 'creditfactuur' : x.doc_type, x.number || 'concept', fmtDate(x.issue_date), x.client_snapshot.name || '', x.project_name, x.subtotal, x.vat_amount, x.total, x.status]),
      ]),
  )
  files['uitgaven.csv'] = strToU8(
    '﻿' +
      toCsv([
        ['Datum', 'Leverancier', 'Omschrijving', 'Categorie', 'Excl. btw', 'Btw', 'Totaal'],
        ...[...d.expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [fmtDate(e.date), e.supplier, e.description, e.category, e.amount_excl, e.vat_amount, e.total]),
      ]),
  )

  // Geüploade bestanden (bonnen, oude facturen)
  const uploads = [...d.expenses.map((e) => ({ path: e.file_path, folder: 'uitgaven', label: `${e.date} ${e.supplier}` })), ...d.docs.map((x) => ({ path: x.file_path, folder: 'facturen-origineel', label: `${x.number}` }))].filter(
    (u): u is { path: string; folder: string; label: string } => !!u.path,
  )
  for (const [i, u] of uploads.entries()) {
    onProgress(`Bestanden ophalen ${i + 1} van ${uploads.length}…`)
    try {
      const blob = await db.downloadFile(u.path)
      if (!blob) continue
      const ext = u.path.split('.').pop()
      const name = `${u.label}`.replace(/[\\/:*?"<>|]+/g, '-').trim()
      files[`bestanden/${u.folder}/${name} (${u.path.split('/').pop()!.slice(0, 8)}).${ext}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
    } catch {
      files[`bestanden/${u.folder}/ONTBREEKT ${u.label}.txt`] = strToU8(`Kon ${u.path} niet ophalen.`)
    }
  }

  // PDF's van zelfgemaakte facturen en offertes
  const own = sorted.filter((x) => !x.imported && x.number)
  for (const [i, x] of own.entries()) {
    onProgress(`PDF's maken ${i + 1} van ${own.length}…`)
    const credited = d.docs.find((o) => o.id === x.credit_of)?.number
    const folder = x.doc_type === 'offerte' ? 'offertes' : 'facturen'
    files[`pdf/${folder}/${pdfFileName(x)}`] = [new Uint8Array(await (await pdfBlob(x, d.settings, credited)).arrayBuffer()), { level: 0 }]
  }

  files['LEESMIJ.txt'] = strToU8(
    `Back-up JFV Administratie – ${fmtDate(todayIso())}\n\n` +
      `facturen.csv / uitgaven.csv   overzicht, te openen in Excel/Numbers\n` +
      `pdf/                          PDF van elke zelfgemaakte factuur en offerte\n` +
      `bestanden/                    geüploade bonnen en oude facturen\n` +
      `gegevens/                     alle gegevens als JSON (volledig, voor herstel)\n`,
  )
  onProgress('Zip maken…')
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' })
}
