import { useState } from 'react'
import * as db from '../lib/db'
import { useStore } from '../lib/store'
import { eur } from '../lib/calc'
import { KIND_LABEL, type Kind, type Product } from '../lib/types'
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select } from '../components/ui'

const KINDS: Kind[] = ['fotografie', 'video', 'apparatuur']
const DEFAULT_UNIT: Record<Kind, Product['unit']> = { fotografie: 'dagdeel', video: 'dagdeel', apparatuur: 'dag' }

function ProductForm({ product, kind, onClose }: { product?: Product; kind: Kind; onClose: () => void }) {
  const { reload } = useStore()
  const [p, setP] = useState<Omit<Product, 'id'> & { id?: string }>(
    product || { kind, name: '', description: '', unit: DEFAULT_UNIT[kind], price: 0, active: true },
  )
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    await db.save('products', { ...p, price: Number(p.price) })
    await reload()
    onClose()
  }
  async function del() {
    if (!product || !confirm('Verwijderen?')) return
    await db.remove('products', product.id)
    await reload()
    onClose()
  }

  return (
    <Modal title={product ? 'Product bewerken' : `Nieuw: ${KIND_LABEL[p.kind]}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Soort">
          <Select value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as Kind, unit: DEFAULT_UNIT[e.target.value as Kind] })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={p.kind === 'apparatuur' ? 'Pakketnaam' : 'Naam'}>
          <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder={p.kind === 'apparatuur' ? 'Canon R8 camera set' : ''} autoFocus />
        </Field>
        <Field label="Extra omschrijving (optioneel)">
          <Input value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prijs excl. btw">
            <Input type="number" step="0.01" value={p.price} onChange={(e) => setP({ ...p, price: e.target.value as unknown as number })} />
          </Field>
          <Field label="Per">
            <Select value={p.unit} onChange={(e) => setP({ ...p, unit: e.target.value as Product['unit'] })}>
              <option value="dagdeel">Dagdeel</option>
              <option value="dag">Dag</option>
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} />
          Actief (zichtbaar bij factureren)
        </label>
        <div className="flex justify-between pt-2">
          {product ? (
            <Button variant="danger" onClick={del}>
              Verwijderen
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={submit} disabled={busy || !p.name.trim()}>
            Opslaan
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function Products() {
  const { products } = useStore()
  const [edit, setEdit] = useState<{ product?: Product; kind: Kind } | null>(null)

  return (
    <>
      <PageHeader title="Producten & diensten" />
      <div className="space-y-4">
        {KINDS.map((k) => {
          const list = products.filter((p) => p.kind === k).sort((a, b) => a.name.localeCompare(b.name))
          return (
            <Card key={k}>
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h2 className="font-medium">{KIND_LABEL[k]}</h2>
                <Button variant="ghost" onClick={() => setEdit({ kind: k })}>
                  + {k === 'apparatuur' ? 'Pakket' : 'Toevoegen'}
                </Button>
              </div>
              {list.length === 0 ? (
                <Empty>Nog niets toegevoegd.</Empty>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setEdit({ product: p, kind: k })} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
                        <span className={`text-sm ${p.active ? '' : 'text-stone-400 line-through'}`}>{p.name}</span>
                        <span className="text-sm tabular text-stone-600">
                          {eur(p.price)} <span className="text-stone-400">/ {p.unit}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
      {edit && <ProductForm product={edit.product} kind={edit.kind} onClose={() => setEdit(null)} />}
    </>
  )
}
