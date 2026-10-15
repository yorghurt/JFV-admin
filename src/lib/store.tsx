import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import * as db from './db'
import type { Client, Doc, Expense, Product, Settings } from './types'

interface Store {
  loading: boolean
  error: string | null
  settings: Settings
  clients: Client[]
  products: Product[]
  docs: Doc[]
  expenses: Expense[]
  reload: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Store, 'reload'>>({
    loading: true,
    error: null,
    settings: db.DEFAULT_SETTINGS,
    clients: [],
    products: [],
    docs: [],
    expenses: [],
  })

  const reload = useCallback(async () => {
    try {
      const [settings, clients, products, docs, expenses] = await Promise.all([
        db.getSettings(),
        db.list<Client>('clients'),
        db.list<Product>('products'),
        db.list<Doc>('documents'),
        db.list<Expense>('expenses'),
      ])
      setState({ loading: false, error: null, settings, clients, products, docs, expenses })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider ontbreekt')
  return s
}
