import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Settings } from './types'
import { uid } from './calc'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Zonder Supabase-config draait de app in demo-modus (gegevens in de browser). */
export const DEMO = !url || !key
export const supabase: SupabaseClient | null = DEMO ? null : createClient(url!, key!)

export type Table = 'clients' | 'products' | 'documents' | 'expenses'

export const DEFAULT_SETTINGS: Settings = {
  company_name: 'Jorg Foto & Video',
  owner_name: 'Jorg van Gerner',
  address: 'Haringvliet 59',
  postal_city: '6826 VB  Arnhem',
  phone: '+31 (0) 6 128 321 58',
  email: '',
  kvk: '61085944',
  vat_number: 'NL002256165B83',
  iban: 'NL42 ASNB 8850 5150 49',
  payment_days: 14,
  quote_valid_days: 30,
  rental_note:
    'Toelichting: De minimale huurtijd is 0,5 dag.\nHuur van apparatuur door LBL wordt alleen gefactureerd in het geval het een betaalde fotografie opdracht voor een klant betreft. Bij overige opdrachten vindt overleg plaats wat betreft de huur van apparatuur.',
  rental_list_url: '',
  drive_invoices_id: '',
  drive_invoices_name: '',
  drive_receipts_id: '',
  drive_receipts_name: '',
  mail_bcc: 'jorgvangerner@gmail.com',
  mail_invoice_subject: 'Factuur {nummer} – Jorg Foto & Video',
  mail_invoice_body: 'Beste {naam},\n\nIn de bijlage vind je factuur {nummer} van {bedrag}. Graag betalen vóór {vervaldatum} op {iban} o.v.v. het factuurnummer.\n\nMet vriendelijke groet,\n\nJorg van Gerner\nJorg Foto & Video\n+31 (0)6 128 321 58',
  mail_quote_subject: 'Offerte {nummer} – Jorg Foto & Video',
  mail_quote_body: 'Beste {naam},\n\nIn de bijlage vind je offerte {nummer} van {bedrag}. De offerte is geldig tot {vervaldatum}.\n\nMet vriendelijke groet,\n\nJorg van Gerner\nJorg Foto & Video\n+31 (0)6 128 321 58',
  mail_reminder_subject: 'Herinnering factuur {nummer}',
  mail_reminder_body: 'Beste {naam},\n\nVolgens mijn administratie staat factuur {nummer} van {bedrag} (vervaldatum {vervaldatum}) nog open. Wil je deze binnen 7 dagen voldoen op {iban} o.v.v. het factuurnummer? Is de betaling al onderweg, dan kun je dit bericht negeren. De factuur zit nogmaals in de bijlage.\n\nMet vriendelijke groet,\n\nJorg van Gerner\nJorg Foto & Video\n+31 (0)6 128 321 58',
}

const demoKey = (t: string) => `jfv-demo-${t}`
function demoRead<T>(t: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(demoKey(t)) || '[]')
  } catch {
    return []
  }
}
function demoWrite(t: string, rows: unknown[]) {
  localStorage.setItem(demoKey(t), JSON.stringify(rows))
}

export async function list<T>(table: Table): Promise<T[]> {
  if (DEMO) return demoRead<T>(table)
  const { data, error } = await supabase!.from(table).select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as T[]
}

export async function save<T extends { id?: string }>(table: Table, row: T): Promise<T & { id: string }> {
  if (DEMO) {
    const rows = demoRead<T & { id: string }>(table)
    const r = { ...row, id: row.id || uid(), created_at: new Date().toISOString() } as T & { id: string }
    const i = rows.findIndex((x) => x.id === r.id)
    if (i >= 0) rows[i] = { ...rows[i], ...r }
    else rows.unshift(r)
    demoWrite(table, rows)
    return r
  }
  const { data, error } = await supabase!.from(table).upsert(row).select().single()
  if (error) throw error
  return data as T & { id: string }
}

export async function remove(table: Table, id: string) {
  if (DEMO) return demoWrite(table, demoRead<{ id: string }>(table).filter((r) => r.id !== id))
  const { error } = await supabase!.from(table).delete().eq('id', id)
  if (error) throw error
}

const stripNulls = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null))

export async function getSettings(): Promise<Settings> {
  if (DEMO) return { ...DEFAULT_SETTINGS, ...(demoRead<Settings>('settings')[0] || {}) }
  const { data, error } = await supabase!.from('settings').select('*').maybeSingle()
  if (error) throw error
  if (!data) {
    const { data: created, error: e2 } = await supabase!.from('settings').insert({}).select().single()
    if (e2) throw e2
    return { ...DEFAULT_SETTINGS, ...stripNulls(created) } as Settings
  }
  return { ...DEFAULT_SETTINGS, ...stripNulls(data) } as Settings
}

export async function saveSettings(s: Settings) {
  if (DEMO) return demoWrite('settings', [s])
  const { data: u } = await supabase!.auth.getUser()
  const { error } = await supabase!.from('settings').upsert({ ...s, user_id: u.user!.id, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function uploadFile(file: File, folder: string): Promise<string | null> {
  if (DEMO) return null
  const { data: u } = await supabase!.auth.getUser()
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${u.user!.id}/${folder}/${uid()}.${ext}`
  const { error } = await supabase!.storage.from('files').upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function fileUrl(path: string) {
  if (DEMO) return null
  const { data, error } = await supabase!.storage.from('files').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

export async function removeFile(path: string | null) {
  if (DEMO || !path) return
  await supabase!.storage.from('files').remove([path])
}
