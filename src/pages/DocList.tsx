import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { eur, fmtDate, isOverdue } from '../lib/calc'
import type { Doc, DocType } from '../lib/types'
import { Badge, Button, Card, Empty, PageHeader, Tabs } from '../components/ui'
import { ImportInvoice } from './ImportInvoice'

export function displayStatus(d: Doc) {
  return isOverdue(d) ? 'vervallen' : d.status
}

const FILTERS = {
  factuur: [
    ['alle', 'Alle'],
    ['concept', 'Concept'],
    ['verzonden', 'Openstaand'],
    ['vervallen', 'Vervallen'],
    ['betaald', 'Betaald'],
  ],
  offerte: [
    ['alle', 'Alle'],
    ['concept', 'Concept'],
    ['verzonden', 'Verzonden'],
    ['geaccepteerd', 'Geaccepteerd'],
    ['afgewezen', 'Afgewezen'],
  ],
} as const

export function DocList({ type }: { type: DocType }) {
  const { docs } = useStore()
  const nav = useNavigate()
  const [filter, setFilter] = useState<string>('alle')
  const [importing, setImporting] = useState(false)
  const base = type === 'factuur' ? '/facturen' : '/offertes'

  const rows = useMemo(
    () =>
      docs
        .filter((d) => d.doc_type === type)
        .filter((d) => {
          if (filter === 'alle') return true
          const st = displayStatus(d)
          return filter === 'verzonden' ? d.status === 'verzonden' : st === filter
        })
        .sort((a, b) => (b.number || '999999').localeCompare(a.number || '999999') || b.issue_date.localeCompare(a.issue_date)),
    [docs, type, filter],
  )

  return (
    <>
      <PageHeader
        title={type === 'factuur' ? 'Facturen' : 'Offertes'}
        actions={
          <>
            {type === 'factuur' && <Button onClick={() => setImporting(true)}>Importeer bestaande factuur</Button>}
            <Button variant="primary" onClick={() => nav(`${base}/nieuw`)}>
              + Nieuwe {type}
            </Button>
          </>
        }
      />
      <Tabs value={filter} onChange={setFilter} options={FILTERS[type] as unknown as [string, string][]} />
      <Card>
        {rows.length === 0 ? (
          <Empty>Nog geen {type === 'factuur' ? 'facturen' : 'offertes'}.</Empty>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((d) => (
              <li key={d.id}>
                <Link to={`${base}/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  <div className="w-24 shrink-0 text-sm font-medium tabular">{d.number || '—'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{d.client_snapshot.name || 'Geen klant'}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {fmtDate(d.issue_date)}
                      {d.project_name ? ` · ${d.project_name}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium tabular">{eur(d.total)}</div>
                    <div className="mt-0.5 flex justify-end gap-1">
                      {d.imported && <Badge status="geïmporteerd" />}
                      <Badge status={displayStatus(d)} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {importing && <ImportInvoice onClose={() => setImporting(false)} />}
    </>
  )
}
