import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { fmtDate, lineTotal, num, eur } from '../lib/calc'
import type { Doc, Line, Settings } from '../lib/types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, paddingTop: 70, paddingHorizontal: 42, paddingBottom: 100, color: '#000' },
  client: { position: 'absolute', top: 88, left: 78, fontSize: 9.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  italic: { fontFamily: 'Helvetica-Oblique' },
  logo: { position: 'absolute', top: 68, left: 396, width: 106, height: 106 },
  title: { marginTop: 112, fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 18 },
  metaRow: { flexDirection: 'row', marginBottom: 1.5 },
  metaLabel: { width: 110 },
  metaColon: { width: 34 },
  dotted: { borderBottomWidth: 0.7, borderBottomColor: '#E7A64A', borderStyle: 'dotted' },
  head: { flexDirection: 'row', paddingVertical: 8, marginTop: 30, borderTopWidth: 0.7, borderTopColor: '#E7A64A', borderStyle: 'dotted' },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 54 },
  cPrice: { width: 75 },
  cTotal: { width: 79 },
  row: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 22, paddingLeft: 10 },
  note: { fontFamily: 'Helvetica-Oblique', width: 290, marginTop: 8 },
  link: { fontFamily: 'Helvetica-Oblique', color: '#1155CC', textDecoration: 'underline' },
  totals: { marginTop: 50, marginLeft: 300, width: 211 },
  totRow: { flexDirection: 'row', marginVertical: 6 },
  totLabel: { flex: 1, textAlign: 'right' },
  totColon: { width: 26, textAlign: 'center' },
  totVal: { width: 66, textAlign: 'right' },
  pay: { marginTop: 50 },
  footer: { position: 'absolute', bottom: 40, left: 42, right: 42, flexDirection: 'row', fontSize: 9 },
})

function qty(n: number) {
  return Number.isInteger(Number(n)) ? String(n) : num(n).replace(/0$/, '')
}

const unitWord = (u: Line['unit'], n: number) => (u === 'dag' ? (n === 1 ? 'dag' : 'dagen') : n === 1 ? 'dagdeel' : 'dagdelen')

const GROUP_LABEL = { apparatuur: 'huur apparatuur', fotografie: 'fotografie', video: 'video' } as const

/** Opeenvolgende regels met dezelfde soort + datum krijgen één kopregel, zoals op de oude factuur. */
function groupLines(lines: Line[]) {
  const out: { header: string | null; lines: Line[] }[] = []
  let key = ''
  for (const l of lines) {
    const k = l.date ? `${l.kind}|${l.date}` : ''
    if (out.length && k === key) out[out.length - 1].lines.push(l)
    else {
      out.push({ header: l.date ? `${GROUP_LABEL[l.kind || 'apparatuur']} - ` : null, lines: [l] })
      key = k
    }
  }
  return out
}

export function InvoicePdf({ doc, settings, logoSrc = '/logo.png' }: { doc: Doc; settings: Settings; logoSrc?: string }) {
  const isQuote = doc.doc_type === 'offerte'
  const units = new Set(doc.lines.map((l) => l.unit))
  const mixed = units.size > 1
  const qtyHead = mixed ? 'Aantal' : units.has('dagdeel') ? 'Aantal\ndagdelen' : 'Aantal\ndagen'
  const c = doc.client_snapshot || {}
  const number = doc.number || 'CONCEPT'

  const meta: [string, string][] = [
    [isQuote ? 'Offertedatum' : 'Factuurdatum', fmtDate(doc.issue_date)],
    ['Opdrachtnaam', doc.project_name],
    [isQuote ? 'Offertenummer' : 'Factuurnummer', number],
    [isQuote ? 'Geldig tot' : 'Vervaldatum', fmtDate(doc.due_date)],
  ]
  if (doc.po_number) meta.push(['PO-nummer:', doc.po_number])

  return (
    <Document title={`${isQuote ? 'Offerte' : 'Factuur'} ${number}`} author={settings.company_name}>
      <Page size="A4" style={s.page}>
        <View style={s.client} fixed>
          <Text style={s.bold}>{c.name}</Text>
          {c.contact ? <Text>{c.contact}</Text> : null}
          <Text>{c.address}</Text>
          <Text>{c.postal_city}</Text>
        </View>
        <Image style={s.logo} src={logoSrc} fixed />

        <Text style={s.title}>{isQuote ? 'Offerte' : 'Factuur'}</Text>
        {meta.map(([k, v]) => (
          <View key={k} style={s.metaRow}>
            <Text style={s.metaLabel}>{k}</Text>
            <Text style={s.metaColon}>:</Text>
            <Text>{v}</Text>
          </View>
        ))}

        <View style={[s.head, s.dotted]}>
          <Text style={[s.cDesc, s.bold]}>Omschrijving</Text>
          <Text style={[s.cQty, s.bold]}>{qtyHead}</Text>
          <Text style={[s.cPrice, s.bold]}>{'Prijs EUR\nper eenheid'}</Text>
          <Text style={[s.cTotal, s.bold]}>Prijs EUR</Text>
        </View>

        {doc.note ? <Text style={s.note}>{doc.note}</Text> : null}
        {doc.show_rental_link && settings.rental_list_url ? (
          <Link style={s.link} src={settings.rental_list_url}>
            Verhuurlijst
          </Link>
        ) : null}

        <View style={{ marginTop: 18 }}>
          {groupLines(doc.lines).map((g, gi) => (
            <View key={gi} wrap={false} style={{ marginBottom: 4 }}>
              {g.header ? (
                <View style={s.row}>
                  <Text style={s.bullet}>-</Text>
                  <Text>
                    {g.header}
                    <Text style={s.italic}>{fmtDate(g.lines[0].date)}</Text>
                  </Text>
                </View>
              ) : null}
              {g.lines.map((l) => (
                <View key={l.id} style={s.row}>
                  <View style={[s.cDesc, { flexDirection: 'row' }]}>
                    <Text style={s.bullet}>-</Text>
                    <Text style={{ flex: 1 }}>{l.description}</Text>
                  </View>
                  <Text style={s.cQty}>{mixed ? `${qty(l.quantity)} ${unitWord(l.unit, l.quantity)}` : qty(l.quantity)}</Text>
                  <Text style={s.cPrice}>{num(l.price)}</Text>
                  <Text style={s.cTotal}>{num(lineTotal(l))}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={[s.dotted, { marginLeft: 100 }]} />
          <View style={[s.totRow, { marginTop: 10 }]}>
            <Text style={s.totLabel}>Subtotaal</Text>
            <Text style={s.totColon}>:</Text>
            <Text style={s.totVal}>{eur(doc.subtotal)}</Text>
          </View>
          <View style={s.totRow}>
            <Text style={s.totLabel}>BTW ({num(doc.vat_rate).replace(',00', '')}%)</Text>
            <Text style={s.totColon}>:</Text>
            <Text style={s.totVal}>{eur(doc.vat_amount)}</Text>
          </View>
          <View style={[s.dotted, { marginLeft: 100 }]} />
          <View style={[s.totRow, { marginTop: 10 }]}>
            <Text style={[s.totLabel, s.bold]}>{isQuote ? 'TOTAAL' : 'TOTAAL te voldoen'}</Text>
            <Text style={[s.totColon, s.bold]}>:</Text>
            <Text style={[s.totVal, s.bold]}>{eur(doc.total)}</Text>
          </View>
          <View style={[s.dotted, { marginLeft: 100 }]} />
        </View>

        <Text style={s.pay} wrap={false}>
          {isQuote
            ? `Deze offerte is geldig tot ${fmtDate(doc.due_date)}.`
            : `Ik verzoek u vriendelijk het bedrag binnen ${settings.payment_days} dagen te betalen op\nrekeningnummer ${settings.iban} onder vermelding van het factuurnummer.`}
        </Text>

        <View style={s.footer} fixed>
          <View style={{ width: 120 }}>
            <Text style={s.bold}>{settings.company_name}</Text>
            <Text>{settings.owner_name}</Text>
            <Text>{settings.phone}</Text>
          </View>
          <View style={{ width: 200 }}>
            <Text> </Text>
            <Text>{settings.address}</Text>
            <Text>{settings.postal_city}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text> </Text>
            <Text>KVK: {settings.kvk}</Text>
            <Text>BTW-nr: {settings.vat_number}</Text>
            <Text>Rek.nr: {settings.iban}</Text>
          </View>
          <Text style={{ width: 20, textAlign: 'right', alignSelf: 'flex-end' }} render={({ pageNumber }) => String(pageNumber)} />
        </View>
      </Page>
    </Document>
  )
}
