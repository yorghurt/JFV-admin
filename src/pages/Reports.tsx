import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { download, eur, num, periodSummary, quarterOf, round2, toCsv, fmtDate } from '../lib/calc'
import { EXPENSE_CATEGORIES } from '../lib/types'
import type { ReportSection } from '../pdf/ReportPdf'
import { Button, Card, PageHeader, Select, Tabs } from '../components/ui'

export function usePeriod() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState<number>(quarterOf(now.toISOString()))
  return { year, setYear, quarter, setQuarter }
}

export function PeriodPicker({ year, setYear, quarter, setQuarter, allowYear }: ReturnType<typeof usePeriod> & { allowYear?: boolean }) {
  const now = new Date().getFullYear()
  const years = Array.from({ length: now - 2023 }, (_, i) => now - i)
  return (
    <div className="flex gap-2">
      <Select className="w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </Select>
      <Select className="w-auto" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
        {[1, 2, 3, 4].map((q) => (
          <option key={q} value={q}>
            Q{q}
          </option>
        ))}
        {allowYear && <option value={0}>Heel jaar</option>}
      </Select>
    </div>
  )
}

/** Belastingdienst: omzet en verschuldigde btw naar beneden afronden, voorbelasting naar boven. */
const down = (n: number) => Math.floor(n)
const up = (n: number) => Math.ceil(n)

async function pdfDownload(name: string, title: string, subtitle: string, sections: ReportSection[], company: string) {
  const [{ pdf }, { ReportPdf }] = await Promise.all([import('@react-pdf/renderer'), import('../pdf/ReportPdf')])
  const blob = await pdf(<ReportPdf title={title} subtitle={subtitle} sections={sections} company={company} />).toBlob()
  download(name, blob)
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  )
}

function VatTab() {
  const { docs, expenses, settings } = useStore()
  const period = usePeriod()
  const { year, quarter } = period
  const p = useMemo(() => periodSummary(docs, expenses, year, quarter || undefined), [docs, expenses, year, quarter])
  const label = quarter ? `Q${quarter} ${year}` : `${year}`
  const balance = round2(p.vatOut - p.vatIn)

  const rubrieken: [string, string, number | null, number, number][] = [
    ['1a', 'Leveringen/diensten belast met hoog tarief (21%)', p.revenue, p.vatOut, down(p.vatOut)],
    ['5a', 'Verschuldigde omzetbelasting', null, p.vatOut, down(p.vatOut)],
    ['5b', 'Voorbelasting', null, p.vatIn, up(p.vatIn)],
    ['5c', 'Subtotaal (5a min 5b)', null, balance, down(p.vatOut) - up(p.vatIn)],
    ['5g', balance >= 0 ? 'Totaal te betalen' : 'Totaal terug te vragen', null, Math.abs(balance), Math.abs(down(p.vatOut) - up(p.vatIn))],
  ]

  const quarters = [1, 2, 3, 4].map((q) => ({ q, ...periodSummary(docs, expenses, year, q) }))

  const sections = (): ReportSection[] => [
    {
      title: `Btw-aangifte ${label}`,
      head: ['Rubriek', 'Omzet', 'Btw', 'Aangifte (afgerond)'],
      rows: rubrieken.map(([r, l, o, b, a]) => [`${r}  ${l}`, o === null ? '' : eur(o), eur(b), `€ ${a}`]),
      boldLast: true,
    },
    ...(!quarter
      ? [
          {
            title: 'Per kwartaal',
            head: ['Kwartaal', 'Omzet excl.', 'Btw omzet', 'Voorbelasting', 'Saldo'],
            rows: quarters.map((x) => [`Q${x.q}`, eur(x.revenue), eur(x.vatOut), eur(x.vatIn), eur(x.vatOut - x.vatIn)]),
          },
        ]
      : []),
    {
      title: 'Verkoopfacturen',
      head: ['Factuur', 'Datum', 'Excl.', 'Btw'],
      rows: p.invoices.map((d) => [`${d.number} ${d.client_snapshot.name || ''}`, fmtDate(d.issue_date), eur(d.subtotal), eur(d.vat_amount)]),
    },
    {
      title: 'Inkoop / kosten',
      head: ['Leverancier', 'Datum', 'Excl.', 'Btw'],
      rows: p.expenses.map((e) => [`${e.supplier} ${e.description}`.trim(), fmtDate(e.date), eur(e.amount_excl), eur(e.vat_amount)]),
    },
  ]

  function csv() {
    const rows: (string | number)[][] = [['Btw-overzicht', label], [], ['Rubriek', 'Omschrijving', 'Omzet', 'Btw', 'Aangifte afgerond']]
    rubrieken.forEach(([r, l, o, b, a]) => rows.push([r, l, o ?? '', b, a]))
    if (!quarter) {
      rows.push([], ['Kwartaal', 'Omzet excl', 'Btw omzet', 'Voorbelasting', 'Saldo'])
      quarters.forEach((x) => rows.push([`Q${x.q}`, x.revenue, x.vatOut, x.vatIn, round2(x.vatOut - x.vatIn)]))
    }
    rows.push([], ['Type', 'Nummer/leverancier', 'Datum', 'Excl', 'Btw', 'Totaal'])
    p.invoices.forEach((d) => rows.push(['Verkoop', `${d.number} ${d.client_snapshot.name || ''}`, fmtDate(d.issue_date), d.subtotal, d.vat_amount, d.total]))
    p.expenses.forEach((e) => rows.push(['Inkoop', e.supplier, fmtDate(e.date), e.amount_excl, e.vat_amount, e.total]))
    download(`btw-${label.replace(' ', '-')}.csv`, toCsv(rows))
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PeriodPicker {...period} allowYear />
        <div className="flex gap-2">
          <Button onClick={csv}>CSV</Button>
          <Button onClick={() => pdfDownload(`btw-${label.replace(' ', '-')}.pdf`, 'Btw-overzicht', `${settings.company_name} · ${label}`, sections(), settings.company_name)}>PDF</Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Omzet excl. btw" value={eur(p.revenue)} />
        <Stat label="Btw over omzet" value={eur(p.vatOut)} />
        <Stat label="Voorbelasting" value={eur(p.vatIn)} />
        <Stat label={balance >= 0 ? 'Te betalen' : 'Terug te vragen'} value={eur(Math.abs(balance))} />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th className="px-4 py-2 font-medium">Rubriek</th>
              <th className="px-4 py-2 text-right font-medium">Omzet</th>
              <th className="px-4 py-2 text-right font-medium">Btw</th>
              <th className="px-4 py-2 text-right font-medium">Invullen</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {rubrieken.map(([r, l, o, b, a]) => (
              <tr key={r} className={`border-b border-neutral-50 ${r === '5g' ? 'font-semibold' : ''}`}>
                <td className="px-4 py-2">
                  <span className="mr-2 text-neutral-400">{r}</span>
                  {l}
                </td>
                <td className="px-4 py-2 text-right">{o === null ? '' : eur(o)}</td>
                <td className="px-4 py-2 text-right">{eur(b)}</td>
                <td className="px-4 py-2 text-right">€ {a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-neutral-500">
          Gebaseerd op factuurdatum (factuurstelsel). Conceptfacturen tellen niet mee. "Invullen" is afgerond zoals de Belastingdienst vraagt.
        </p>
      </Card>
      {!quarter && (
        <Card className="mt-4 overflow-x-auto">
          <QuarterTable rows={quarters.map((x) => [`Q${x.q}`, x.revenue, x.vatOut, x.vatIn, round2(x.vatOut - x.vatIn)])} head={['Kwartaal', 'Omzet excl.', 'Btw omzet', 'Voorbelasting', 'Saldo']} />
        </Card>
      )}
    </>
  )
}

export function QuarterTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-100 text-xs text-neutral-500">
          {head.map((h, i) => (
            <th key={h} className={`px-4 py-2 font-medium ${i ? 'text-right' : 'text-left'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map((r, ri) => (
          <tr key={ri} className={`border-b border-neutral-50 ${String(r[0]).startsWith('Totaal') ? 'font-semibold' : ''}`}>
            {r.map((c, i) => (
              <td key={i} className={`px-4 py-2 ${i ? 'text-right' : ''}`}>
                {typeof c === 'number' ? eur(c) : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function YearTab() {
  const { docs, expenses, settings } = useStore()
  const period = usePeriod()
  const { year } = period
  const y = useMemo(() => periodSummary(docs, expenses, year), [docs, expenses, year])
  const quarters = [1, 2, 3, 4].map((q) => ({ q, ...periodSummary(docs, expenses, year, q) }))
  const byCat = EXPENSE_CATEGORIES.map((c) => [c, round2(y.expenses.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount_excl), 0))] as [string, number]).filter(
    ([, v]) => v !== 0,
  )
  const profit = round2(y.revenue - y.costs)
  const qRows: (string | number)[][] = [
    ...quarters.map((x) => [`Q${x.q}`, x.revenue, x.costs, round2(x.revenue - x.costs)]),
    ['Totaal', y.revenue, y.costs, profit],
  ]

  const sections = (): ReportSection[] => [
    { title: 'Resultaat', rows: [['Omzet (excl. btw)', eur(y.revenue)], ['Kosten (excl. btw)', eur(y.costs)], ['Winst', eur(profit)]], boldLast: true },
    { title: 'Inkomsten en uitgaven per kwartaal', head: ['Kwartaal', 'Inkomsten', 'Uitgaven', 'Resultaat'], rows: qRows.map((r) => r.map((c) => (typeof c === 'number' ? eur(c) : c))), boldLast: true },
    { title: 'Kosten per categorie', head: ['Categorie', 'Bedrag'], rows: [...byCat.map(([c, v]) => [c, eur(v)]), ['Totaal', eur(y.costs)]], boldLast: true },
    { title: 'Btw', rows: [['Btw over omzet', eur(y.vatOut)], ['Voorbelasting', eur(y.vatIn)], ['Saldo', eur(y.vatOut - y.vatIn)]], boldLast: true },
  ]

  function csv() {
    const rows: (string | number)[][] = [['Jaaroverzicht', year], [], ['Omzet excl btw', y.revenue], ['Kosten excl btw', y.costs], ['Winst', profit], []]
    rows.push(['Kwartaal', 'Inkomsten', 'Uitgaven', 'Resultaat'], ...qRows, [], ['Categorie', 'Bedrag'], ...byCat, [])
    rows.push(['Btw over omzet', y.vatOut], ['Voorbelasting', y.vatIn], ['Saldo', round2(y.vatOut - y.vatIn)])
    download(`jaaroverzicht-${year}.csv`, toCsv(rows))
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Select className="w-auto" value={year} onChange={(e) => period.setYear(Number(e.target.value))}>
          {Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => new Date().getFullYear() - i).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button onClick={csv}>CSV</Button>
          <Button onClick={() => pdfDownload(`jaaroverzicht-${year}.pdf`, `Jaaroverzicht ${year}`, settings.company_name, sections(), settings.company_name)}>PDF</Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Omzet" value={eur(y.revenue)} sub="excl. btw" />
        <Stat label="Kosten" value={eur(y.costs)} sub="excl. btw" />
        <Stat label="Winst" value={eur(profit)} />
      </div>
      <Card className="mb-4 overflow-x-auto">
        <h2 className="px-4 pt-3 text-sm font-medium">Inkomsten en uitgaven per kwartaal</h2>
        <QuarterTable head={['Kwartaal', 'Inkomsten', 'Uitgaven', 'Resultaat']} rows={qRows} />
      </Card>
      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-3 text-sm font-medium">Kosten per categorie</h2>
        <QuarterTable head={['Categorie', 'Bedrag']} rows={[...byCat, ['Totaal', y.costs]]} />
      </Card>
      <p className="mt-3 text-xs text-neutral-500">Investeringen tellen volledig als kosten in het aanschafjaar. Btw-saldo jaar: {num(y.vatOut - y.vatIn)}.</p>
    </>
  )
}

export function Reports() {
  const [tab, setTab] = useState<'btw' | 'jaar'>('btw')
  return (
    <>
      <PageHeader title="Btw & rapportages" />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ['btw', 'Btw-aangifte'],
          ['jaar', 'Jaaroverzicht'],
        ]}
      />
      {tab === 'btw' ? <VatTab /> : <YearTab />}
    </>
  )
}
