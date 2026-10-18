import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { eur, fmtDate, lineTotal, num } from '../lib/calc'
import type { Doc, Line, Settings } from '../lib/types'

/** Huisstijl: geel uit het logo, Barlow Condensed voor koppen, Inter voor tekst. */
export const BRAND = { yellow: '#FFC861', yellowSoft: '#FFF4DE', ink: '#1C1A17', grey: '#6E6A64', line: '#E8E4DC', paper: '#FAF8F4' }

let fontsReady = false
export function registerFonts(base = '/fonts/') {
  if (fontsReady) return
  Font.register({
    family: 'Barlow',
    fonts: [
      { src: `${base}barlow-condensed-latin-600-normal.woff`, fontWeight: 600 },
      { src: `${base}barlow-condensed-latin-700-normal.woff`, fontWeight: 700 },
    ],
  })
  Font.register({
    family: 'Inter',
    fonts: [
      { src: `${base}inter-latin-400-normal.woff` },
      { src: `${base}inter-latin-600-normal.woff`, fontWeight: 600 },
      { src: `${base}inter-latin-700-normal.woff`, fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((w) => [w])
  fontsReady = true
}

const C = BRAND
const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 8.5, color: C.ink, paddingHorizontal: 48, paddingBottom: 70 },
  band: { height: 8, backgroundColor: C.yellow, marginHorizontal: -48 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  sender: { textAlign: 'right', color: C.grey },
  h1: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 34, letterSpacing: 0.5, marginTop: 34 },
  num: { fontFamily: 'Barlow', fontWeight: 600, color: C.grey },
  label: { fontSize: 7, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  metaRow: { flexDirection: 'row', marginTop: 22, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  th: { flexDirection: 'row', backgroundColor: C.yellowSoft, paddingVertical: 7, paddingHorizontal: 8, marginTop: 26, fontWeight: 600 },
  tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: C.line },
  cD: { flex: 1, paddingRight: 8 },
  cQ: { width: 64, textAlign: 'right' },
  cP: { width: 70, textAlign: 'right' },
  cT: { width: 70, textAlign: 'right' },
  sub: { color: C.grey, fontSize: 7.5, marginTop: 2 },
  note: { color: C.grey, marginTop: 10, paddingHorizontal: 8, width: 330 },
  totals: { marginLeft: 'auto', width: 220, marginTop: 18 },
  totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.yellow, paddingVertical: 9, paddingHorizontal: 8, marginTop: 6 },
  grandTxt: { fontFamily: 'Barlow', fontWeight: 700, fontSize: 15 },
  pay: { marginTop: 34, padding: 12, borderLeftWidth: 3, borderColor: C.yellow, backgroundColor: C.paper },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', color: C.grey, fontSize: 7.5, borderTopWidth: 1, borderColor: C.line, paddingTop: 8 },
})

const qty = (n: number) => (Number.isInteger(Number(n)) ? String(n) : num(n).replace(/0$/, ''))
const unitWord = (u: Line['unit'], n: number) => (u === 'dag' ? (n === 1 ? 'dag' : 'dagen') : n === 1 ? 'dagdeel' : 'dagdelen')
const KIND = { apparatuur: 'Huur apparatuur', fotografie: 'Fotografie', video: 'Video' } as const

export function InvoicePdf({ doc, settings, creditedNumber, logoSrc = '/logo.png', fontBase }: { doc: Doc; settings: Settings; creditedNumber?: string | null; logoSrc?: string; fontBase?: string }) {
  registerFonts(fontBase)
  const isQuote = doc.doc_type === 'offerte'
  const isCredit = !!doc.credit_of
  const kind = isQuote ? 'Offerte' : isCredit ? 'Creditfactuur' : 'Factuur'
  const c = doc.client_snapshot || {}
  const number = doc.number || 'concept'

  const meta: [string, string][] = [
    [isQuote ? 'Offertedatum' : 'Factuurdatum', fmtDate(doc.issue_date)],
    isCredit ? ['Betreft factuur', creditedNumber || ''] : [isQuote ? 'Geldig tot' : 'Vervaldatum', fmtDate(doc.due_date)],
    ['Opdracht', doc.project_name],
  ]
  if (doc.po_number) meta.push(['PO-nummer', doc.po_number])

  return (
    <Document title={`${kind} ${number}`} author={settings.company_name}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <View style={s.top}>
          <Image src={logoSrc} style={{ width: 78, height: 78 }} />
          <View style={s.sender}>
            <Text style={{ fontWeight: 700, color: C.ink, fontSize: 9.5 }}>{settings.company_name}</Text>
            <Text>{settings.owner_name}</Text>
            <Text>{settings.address}</Text>
            <Text>{settings.postal_city.replace(/\s+/g, ' ')}</Text>
            <Text>{settings.phone}</Text>
            {settings.email ? <Text>{settings.email}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={[s.h1, isCredit ? { fontSize: 30 } : {}]}>
            {kind} <Text style={s.num}>{number}</Text>
          </Text>
          <View style={{ width: 200, marginBottom: 6 }}>
            <Text style={s.label}>Aan</Text>
            <Text style={{ fontWeight: 600 }}>{c.name}</Text>
            {c.contact ? <Text>{c.contact}</Text> : null}
            <Text>{c.address}</Text>
            <Text>{(c.postal_city || '').replace(/\s+/g, ' ')}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          {meta.map(([k, v]) => (
            <View key={k} style={{ flex: 1 }}>
              <Text style={s.label}>{k}</Text>
              <Text style={{ fontWeight: 600 }}>{v || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.th}>
          <Text style={s.cD}>Omschrijving</Text>
          <Text style={s.cQ}>Aantal</Text>
          <Text style={s.cP}>Prijs</Text>
          <Text style={s.cT}>Bedrag</Text>
        </View>
        {doc.lines.map((l) => {
          const sub = [l.kind ? KIND[l.kind] : '', l.date ? fmtDate(l.date) : ''].filter(Boolean).join(' · ')
          return (
            <View key={l.id} style={s.tr} wrap={false}>
              <View style={s.cD}>
                <Text style={{ fontWeight: 600 }}>{l.description}</Text>
                {sub ? <Text style={s.sub}>{sub}</Text> : null}
              </View>
              <Text style={s.cQ}>{`${qty(l.quantity)} ${unitWord(l.unit, Number(l.quantity))}`}</Text>
              <Text style={s.cP}>{eur(l.price)}</Text>
              <Text style={s.cT}>{eur(lineTotal(l))}</Text>
            </View>
          )
        })}

        {doc.note || (doc.show_rental_link && settings.rental_list_url) ? (
          <Text style={s.note}>
            {doc.note.replace(/^Toelichting:\s*/i, '')}{' '}
            {doc.show_rental_link && settings.rental_list_url ? (
              <Link src={settings.rental_list_url} style={{ color: C.ink, textDecoration: 'underline' }}>
                Verhuurlijst
              </Link>
            ) : null}
          </Text>
        ) : null}

        <View style={s.totals} wrap={false}>
          <View style={s.totRow}>
            <Text style={{ color: C.grey }}>Subtotaal</Text>
            <Text>{eur(doc.subtotal)}</Text>
          </View>
          <View style={s.totRow}>
            <Text style={{ color: C.grey }}>Btw {num(doc.vat_rate).replace(',00', '')}%</Text>
            <Text>{eur(doc.vat_amount)}</Text>
          </View>
          <View style={s.grand}>
            <Text style={s.grandTxt}>{isCredit ? 'TOTAAL CREDIT' : 'TOTAAL'}</Text>
            <Text style={s.grandTxt}>{eur(doc.total)}</Text>
          </View>
        </View>

        <View style={s.pay} wrap={false}>
          {isQuote ? (
            <>
              <Text style={{ fontWeight: 600 }}>Geldig tot {fmtDate(doc.due_date)}</Text>
              <Text>Akkoord? Laat het me weten, dan plan ik de opdracht in.</Text>
            </>
          ) : isCredit ? (
            <>
              <Text style={{ fontWeight: 600 }}>Creditering van factuur {creditedNumber}</Text>
              <Text>Dit bedrag wordt verrekend met de oorspronkelijke factuur of aan u terugbetaald.</Text>
            </>
          ) : (
            <>
              <Text style={{ fontWeight: 600 }}>Graag binnen {settings.payment_days} dagen betalen</Text>
              <Text>
                Op {settings.iban} t.n.v. {settings.company_name}, o.v.v. factuurnummer <Text style={{ fontWeight: 600 }}>{number}</Text>.
              </Text>
            </>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>KvK {settings.kvk}</Text>
          <Text>Btw {settings.vat_number}</Text>
          <Text>IBAN {settings.iban}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
