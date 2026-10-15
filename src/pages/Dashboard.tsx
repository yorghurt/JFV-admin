import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { eur, fmtDate, isOverdue, periodSummary, quarterOf, round2, todayIso } from '../lib/calc'
import { Badge, Button, Card, Empty, PageHeader } from '../components/ui'
import { displayStatus } from './DocList'
import { QuarterTable } from './Reports'

export function Dashboard() {
  const { docs, expenses, loading, error } = useStore()
  const nav = useNavigate()
  const today = todayIso()
  const year = Number(today.slice(0, 4))
  const q = quarterOf(today)
  const cur = periodSummary(docs, expenses, year, q)
  const invoices = docs.filter((d) => d.doc_type === 'factuur')
  const overdue = invoices.filter((d) => isOverdue(d, today))
  const open = invoices.filter((d) => d.status === 'verzonden')
  const openSum = open.reduce((s, d) => s + Number(d.total), 0)
  const quarters = [1, 2, 3, 4].map((x) => periodSummary(docs, expenses, year, x))
  const recentInv = [...invoices].sort((a, b) => b.issue_date.localeCompare(a.issue_date)).slice(0, 6)
  const recentExp = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  if (loading) return <p className="text-sm text-neutral-500">Laden…</p>

  return (
    <>
      <PageHeader
        title="Overzicht"
        actions={
          <>
            <Button onClick={() => nav('/uitgaven')}>+ Uitgave</Button>
            <Button onClick={() => nav('/offertes/nieuw')}>+ Offerte</Button>
            <Button variant="primary" onClick={() => nav('/facturen/nieuw')}>
              + Factuur
            </Button>
          </>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Kon gegevens niet laden: {error}</p>}

      {overdue.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            {overdue.length} {overdue.length === 1 ? 'factuur is' : 'facturen zijn'} vervallen. Check je rekening of de betaling binnen is.
          </p>
          <ul className="mt-2 space-y-1">
            {overdue.map((d) => (
              <li key={d.id}>
                <Link to={`/facturen/${d.id}`} className="text-sm text-red-700 underline">
                  {d.number} · {d.client_snapshot.name} · {eur(d.total)} · vervallen {fmtDate(d.due_date)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [`Omzet Q${q}`, eur(cur.revenue), 'excl. btw'],
          [`Kosten Q${q}`, eur(cur.costs), 'excl. btw'],
          [`Btw Q${q}`, eur(round2(cur.vatOut - cur.vatIn)), cur.vatOut - cur.vatIn >= 0 ? 'te betalen' : 'terug te vragen'],
          ['Openstaand', eur(openSum), `${open.length} facturen`],
        ].map(([l, v, s]) => (
          <div key={l} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500">{l}</div>
            <div className="mt-1 text-lg font-semibold tabular">{v}</div>
            <div className="text-xs text-neutral-400">{s}</div>
          </div>
        ))}
      </div>

      <Card className="mb-4 overflow-x-auto">
        <h2 className="px-4 pt-3 text-sm font-medium">Inkomsten en uitgaven {year}</h2>
        <QuarterTable
          head={['Kwartaal', 'Inkomsten', 'Uitgaven', 'Resultaat']}
          rows={quarters.map((x, i) => [`Q${i + 1}`, x.revenue, x.costs, round2(x.revenue - x.costs)])}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <div className="flex items-center justify-between px-4 pt-3">
            <h2 className="text-sm font-medium">Recente facturen</h2>
            <Link to="/facturen" className="text-xs text-neutral-500 hover:text-neutral-900">
              Alle →
            </Link>
          </div>
          {recentInv.length === 0 ? (
            <Empty>Nog geen facturen.</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recentInv.map((d) => (
                <li key={d.id}>
                  <Link to={`/facturen/${d.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-neutral-50">
                    <span className="min-w-0 truncate text-sm">
                      <span className="mr-2 tabular text-neutral-500">{d.number || '—'}</span>
                      {d.client_snapshot.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm tabular">{eur(d.total)}</span>
                      <Badge status={displayStatus(d)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between px-4 pt-3">
            <h2 className="text-sm font-medium">Recente uitgaven</h2>
            <Link to="/uitgaven" className="text-xs text-neutral-500 hover:text-neutral-900">
              Alle →
            </Link>
          </div>
          {recentExp.length === 0 ? (
            <Empty>Nog geen uitgaven.</Empty>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recentExp.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm">
                    <span className="mr-2 text-xs text-neutral-500">{fmtDate(e.date)}</span>
                    {e.supplier || e.description}
                  </span>
                  <span className="shrink-0 text-sm tabular">{eur(e.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
