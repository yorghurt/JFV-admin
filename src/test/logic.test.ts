import { describe, expect, it } from 'vitest'
import { nextNumber, periodSummary, totals, isOverdue } from '../lib/calc'
import { parseText } from '../lib/ocr'
import type { Doc, Expense } from '../lib/types'

describe('nummering', () => {
  it('volgt hoogste nummer van het jaar', () => {
    expect(nextNumber(['202601', '202611', '202509', null], 2026)).toBe('202612')
  })
  it('start nieuw jaar op 01', () => {
    expect(nextNumber(['202611'], 2027)).toBe('202701')
  })
  it('offertes eigen reeks met -O', () => {
    expect(nextNumber(['202601-O', '202602-O', '202611'], 2026, '-O')).toBe('202603-O')
  })
})

describe('bedragen', () => {
  it('berekent btw 21%', () => {
    const t = totals([{ id: '1', kind: 'apparatuur', product_id: null, date: null, description: '', quantity: 1, unit: 'dag', price: 85 }], 21)
    expect(t).toEqual({ subtotal: 85, vat: 17.85, total: 102.85 })
  })
  it('halve dag', () => {
    expect(totals([{ id: '1', kind: 'apparatuur', product_id: null, date: null, description: '', quantity: 0.5, unit: 'dag', price: 85 }], 21).total).toBe(51.43)
  })
})

const doc = (p: Partial<Doc>): Doc => ({ id: 'x', doc_type: 'factuur', number: '1', status: 'verzonden', client_id: null, client_snapshot: {}, issue_date: '2026-09-28', due_date: '2026-10-12', project_name: '', po_number: '', note: '', show_rental_link: false, lines: [], vat_rate: 21, subtotal: 100, vat_amount: 21, total: 121, imported: false, file_path: null, source_quote_id: null, paid_at: null, ...p })

describe('periodes', () => {
  it('kwartaal en concepten', () => {
    const docs = [doc({}), doc({ status: 'concept' }), doc({ issue_date: '2026-10-01' }), doc({ doc_type: 'offerte' })]
    const exp: Expense[] = [{ id: 'e', date: '2026-08-01', supplier: '', description: '', category: 'Overig', amount_excl: 50, vat_amount: 10.5, total: 60.5, file_path: null }]
    const q3 = periodSummary(docs, exp, 2026, 3)
    expect(q3.revenue).toBe(100)
    expect(q3.vatOut).toBe(21)
    expect(q3.vatIn).toBe(10.5)
    expect(periodSummary(docs, exp, 2026).revenue).toBe(200)
  })
  it('vervallen', () => {
    expect(isOverdue(doc({}), '2026-10-15')).toBe(true)
    expect(isOverdue(doc({ status: 'betaald' }), '2026-10-15')).toBe(false)
  })
})

describe('OCR parser', () => {
  it('eigen factuur', () => {
    const text = `LBL Communicatie & Contentmarketing B.V.\nCoehoornstraat 70-2\n6811 LA Arnhem\nFactuur\nFactuurdatum : 28-09-2026\nOpdrachtnaam : Apparatuur - WML\nFactuurnummer : 202611\nVervaldatum : 13-10-2026\nCanon R8 camera set 1 85,00 85,00\nSubtotaal : € 85,00\nBTW (21%) : €17,85\nTOTAAL te voldoen : € 102,85\nBTW-nr: NL002256165B83`
    const p = parseText(text)
    expect(p).toMatchObject({ date: '2026-09-28', number: '202611', total: 102.85, vat: 17.85, excl: 85, supplier: 'LBL Communicatie & Contentmarketing B.V.' })
  })
  it('kassabon zonder btw-regel', () => {
    const p = parseText('CameraNU.nl\nDatum 03/07/2026\nSD kaart 1 49,95\nTotaal EUR 49,95')
    expect(p.date).toBe('2026-07-03')
    expect(p.total).toBe(49.95)
    expect(p.vat).toBe(8.67)
    expect(p.excl).toBe(41.28)
  })
  it('engelse factuur', () => {
    const p = parseText('Adobe Systems\nInvoice Number: IE123456\nInvoice Date 12 januari 2026\nSubtotal 24.79\nVAT 21% 5.21\nTotal 30.00')
    expect(p).toMatchObject({ date: '2026-01-12', total: 30, vat: 5.21, excl: 24.79, number: 'IE123456' })
  })
})

import { matchSupplier } from '../lib/suppliers'
describe('leveranciers', () => {
  it('herkent bekende bedrijven', () => {
    expect(matchSupplier('Amazon EU S.à r.l.\nFactuur', [])).toMatchObject({ name: 'Amazon', source: 'bekend' })
    expect(matchSupplier('Adobe Systems Software Ireland', [])?.category).toBe('Software en abonnementen')
    expect(matchSupplier('Kamera Express B.V.', [])?.name).toBe('Kamera Express')
  })
  it('leert van eerdere uitgaven', () => {
    const h = [{ id: '1', date: '2026-01-01', supplier: 'Fotostudio Arnhem', description: '', category: 'Huur (studio, apparatuur)', amount_excl: 0, vat_amount: 0, total: 0, file_path: null }]
    expect(matchSupplier('FOTOSTUDIO ARNHEM\nhuur 4 uur', h)).toMatchObject({ name: 'Fotostudio Arnhem', category: 'Huur (studio, apparatuur)', source: 'historie' })
  })
  it('eerdere categorie wint bij bekend bedrijf', () => {
    const h = [{ id: '1', date: '2026-01-01', supplier: 'Amazon', description: '', category: 'Kantoorkosten', amount_excl: 0, vat_amount: 0, total: 0, file_path: null }]
    expect(matchSupplier('amazon.nl bestelling', h)?.category).toBe('Kantoorkosten')
  })
  it('eigen naam is geen leverancier', () => {
    expect(matchSupplier('Jorg Foto & Video', [])).toBeNull()
  })
})
