export type Kind = 'fotografie' | 'video' | 'apparatuur'
export type Unit = 'dagdeel' | 'dag'
export type DocType = 'factuur' | 'offerte'
export type InvoiceStatus = 'concept' | 'verzonden' | 'betaald' | 'gecrediteerd'
export type QuoteStatus = 'concept' | 'verzonden' | 'geaccepteerd' | 'afgewezen'

export interface Settings {
  company_name: string
  owner_name: string
  address: string
  postal_city: string
  phone: string
  email: string
  kvk: string
  vat_number: string
  iban: string
  payment_days: number
  quote_valid_days: number
  rental_note: string
  rental_list_url: string
}

export interface Client {
  id: string
  name: string
  contact: string
  address: string
  postal_city: string
  email: string
}

export interface Product {
  id: string
  kind: Kind
  name: string
  description: string
  unit: Unit
  price: number
  active: boolean
}

export interface Line {
  id: string
  kind: Kind | null
  product_id: string | null
  date: string | null
  description: string
  quantity: number
  unit: Unit
  price: number
}

export interface Doc {
  id: string
  doc_type: DocType
  number: string | null
  status: string
  client_id: string | null
  client_snapshot: Partial<Client>
  issue_date: string
  due_date: string | null
  project_name: string
  po_number: string
  note: string
  show_rental_link: boolean
  lines: Line[]
  vat_rate: number
  subtotal: number
  vat_amount: number
  total: number
  imported: boolean
  file_path: string | null
  source_quote_id: string | null
  credit_of: string | null
  paid_at: string | null
  created_at?: string
}

export interface Expense {
  id: string
  date: string
  supplier: string
  description: string
  category: string
  amount_excl: number
  vat_amount: number
  total: number
  file_path: string | null
}

export const KIND_LABEL: Record<Kind, string> = {
  fotografie: 'Fotografie',
  video: 'Video',
  apparatuur: 'Apparatuur',
}

export const EXPENSE_CATEGORIES = [
  'Apparatuur (investeringen)',
  'Kleine aanschaffen (< €450)',
  'Software en abonnementen',
  'Reiskosten en vervoer',
  'Telefoon en internet',
  'Kantoorkosten',
  'Marketing en reclame',
  'Opleiding en vakliteratuur',
  'Verzekeringen',
  'Huur (studio, apparatuur)',
  'Bankkosten',
  'Overig',
]
