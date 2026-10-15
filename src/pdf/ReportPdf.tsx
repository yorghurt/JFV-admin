import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export interface ReportSection {
  title: string
  head?: string[]
  rows: (string | number)[][]
  boldLast?: boolean
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9.5, padding: 42 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  sub: { color: '#555', marginTop: 4 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  head: { fontFamily: 'Helvetica-Bold', borderBottomColor: '#999' },
  first: { flex: 1 },
  cell: { width: 80, textAlign: 'right' },
  foot: { position: 'absolute', bottom: 30, left: 42, right: 42, fontSize: 8, color: '#888' },
})

export function ReportPdf({ title, subtitle, sections, company, logoSrc = '/logo.png' }: { title: string; subtitle: string; sections: ReportSection[]; company: string; logoSrc?: string }) {
  return (
    <Document title={title}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.h1}>{title}</Text>
            <Text style={s.sub}>{subtitle}</Text>
          </View>
          <Image src={logoSrc} style={{ width: 54, height: 54 }} />
        </View>
        {sections.map((sec) => (
          <View key={sec.title} wrap={false}>
            <Text style={s.h2}>{sec.title}</Text>
            {sec.head && (
              <View style={[s.row, s.head]}>
                {sec.head.map((h, i) => (
                  <Text key={i} style={i === 0 ? s.first : s.cell}>
                    {h}
                  </Text>
                ))}
              </View>
            )}
            {sec.rows.map((r, ri) => (
              <View key={ri} style={[s.row, sec.boldLast && ri === sec.rows.length - 1 ? s.head : {}]}>
                {r.map((c, i) => (
                  <Text key={i} style={i === 0 ? s.first : s.cell}>
                    {String(c)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}
        <Text style={s.foot} fixed>
          {company} · gegenereerd op {new Date().toLocaleDateString('nl-NL')}
        </Text>
      </Page>
    </Document>
  )
}
