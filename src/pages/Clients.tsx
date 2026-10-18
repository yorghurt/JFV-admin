import { useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { eur } from '../lib/calc'
import type { Client } from '../lib/types'
import { Button, Card, Empty, Field, Input, Modal, PageHeader } from '../components/ui'

const EMPTY: Omit<Client, 'id'> = { name: '', contact: '', address: '', postal_city: '', email: '' }

export function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (c: Client) => void }) {
  const { reload } = useStore()
  const [c, setC] = useState<Omit<Client, 'id'> & { id?: string }>(client || EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Client) => (e: { target: { value: string } }) => setC((x) => ({ ...x, [k]: e.target.value }))

  async function submit() {
    if (!c.name.trim()) return
    setBusy(true)
    const saved = await db.save('clients', c)
    await reload()
    setBusy(false)
    onSaved?.(saved as Client)
    onClose()
  }

  async function del() {
    if (!client || !confirm(`${client.name} verwijderen?`)) return
    await db.remove('clients', client.id)
    await reload()
    onClose()
  }

  return (
    <Modal title={client ? 'Klant bewerken' : 'Nieuwe klant'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Bedrijfsnaam / naam">
          <Input value={c.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="T.a.v. (optioneel)">
          <Input value={c.contact} onChange={set('contact')} />
        </Field>
        <Field label="Adres">
          <Input value={c.address} onChange={set('address')} />
        </Field>
        <Field label="Postcode en plaats">
          <Input value={c.postal_city} onChange={set('postal_city')} />
        </Field>
        <Field label="E-mail">
          <Input type="email" value={c.email} onChange={set('email')} />
        </Field>
        <div className="flex justify-between pt-2">
          {client ? (
            <Button variant="danger" onClick={del}>
              Verwijderen
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={submit} disabled={busy || !c.name.trim()}>
            Opslaan
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function Clients() {
  const { clients, docs } = useStore()
  const [edit, setEdit] = useState<Client | 'new' | null>(null)
  const revenue = (id: string) =>
    docs.filter((d) => d.client_id === id && d.doc_type === 'factuur' && d.status !== 'concept').reduce((s, d) => s + Number(d.subtotal), 0)

  return (
    <>
      <PageHeader title="Klanten" actions={<Button variant="primary" onClick={() => setEdit('new')}>+ Nieuwe klant</Button>} />
      <Card>
        {clients.length === 0 ? (
          <Empty>Nog geen klanten.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {[...clients]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <li key={c.id}>
                  <button onClick={() => setEdit(c)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-stone-500">{[c.address, c.postal_city].filter(Boolean).join(', ')}</div>
                    </div>
                    <span className="text-sm tabular text-stone-500">{eur(revenue(c.id))}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Card>
      {edit && <ClientForm client={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}
