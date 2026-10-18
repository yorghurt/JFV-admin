/**
 * Google-koppeling (Drive + Gmail) volledig in de browser via Google Identity Services.
 * Geen server en geen wachtwoorden: je geeft toestemming via het Google-venster.
 * Het toegangstoken is ±1 uur geldig en staat alleen in het geheugen.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
export const GOOGLE_ENABLED = !!CLIENT_ID

const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/gmail.send'].join(' ')

type TokenResponse = { access_token: string; expires_in: number; error?: string }
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void; callback: (r: TokenResponse) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResponse) => void }) => TokenClient } } }
  }
}

let token: { value: string; expires: number } | null = null
let client: TokenClient | null = null
let scriptLoad: Promise<void> | null = null

function loadScript() {
  scriptLoad ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google kon niet geladen worden'))
    document.head.appendChild(s)
  })
  return scriptLoad
}

export const isConnected = () => !!token && token.expires > Date.now()

/** Geeft een geldig token; opent zo nodig het Google-venster. */
export async function getToken(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google is nog niet ingesteld (VITE_GOOGLE_CLIENT_ID ontbreekt).')
  if (isConnected()) return token!.value
  await loadScript()
  client ||= window.google!.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPES, callback: () => {} })
  return new Promise((resolve, reject) => {
    client!.callback = (r) => {
      if (r.error || !r.access_token) return reject(new Error('Geen toestemming van Google'))
      token = { value: r.access_token, expires: Date.now() + (r.expires_in - 60) * 1000 }
      resolve(r.access_token)
    }
    client!.requestAccessToken({ prompt: '' })
  })
}

async function api(url: string, init: RequestInit = {}) {
  const t = await getToken()
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } })
  if (!res.ok) throw new Error(`Google: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

// ---------- Drive ----------

export interface DriveItem {
  id: string
  name: string
  mimeType: string
}

const FOLDER = 'application/vnd.google-apps.folder'
const DRIVE = 'https://www.googleapis.com/drive/v3/files'
const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function query(qs: string): Promise<DriveItem[]> {
  const url = `${DRIVE}?q=${encodeURIComponent(qs)}&fields=files(id,name,mimeType)&orderBy=name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`
  return (await (await api(url)).json()).files
}

export const listFolders = (parent = 'root') => query(`'${parent}' in parents and mimeType='${FOLDER}' and trashed=false`)

const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
export const listDocuments = (folder: string) =>
  query(`'${folder}' in parents and trashed=false and (${DOC_TYPES.map((t) => `mimeType='${t}'`).join(' or ')})`)

/** Submap opzoeken of aanmaken. */
export async function ensureFolder(name: string, parent: string) {
  const found = await query(`'${parent}' in parents and name='${q(name)}' and mimeType='${FOLDER}' and trashed=false`)
  if (found[0]) return found[0].id
  const res = await api(`${DRIVE}?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }),
  })
  return (await res.json()).id as string
}

/** Pad van mappen aanmaken, bijv. ['2026', 'Q4']. */
export async function ensurePath(parts: string[], root: string) {
  let id = root
  for (const p of parts) id = await ensureFolder(p, id)
  return id
}

/** Bestand uploaden; bestaat dezelfde naam al in de map, dan wordt die overschreven. */
export async function uploadToDrive(blob: Blob, name: string, folder: string) {
  const existing = await query(`'${folder}' in parents and name='${q(name)}' and trashed=false`)
  const meta = existing[0] ? { name } : { name, parents: [folder] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', blob)
  const url = existing[0]
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing[0].id}?uploadType=multipart&supportsAllDrives=true`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`
  await api(url, { method: existing[0] ? 'PATCH' : 'POST', body: form })
}

export async function downloadFromDrive(item: DriveItem): Promise<File> {
  const blob = await (await api(`${DRIVE}/${item.id}?alt=media&supportsAllDrives=true`)).blob()
  return new File([blob], item.name, { type: item.mimeType })
}

export async function moveFile(id: string, from: string, to: string) {
  await api(`${DRIVE}/${id}?addParents=${to}&removeParents=${from}&supportsAllDrives=true`, { method: 'PATCH' })
}

// ---------- Gmail ----------

const b64 = (u8: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}
const b64utf8 = (s: string) => b64(new TextEncoder().encode(s))
const wrap = (s: string) => s.replace(/.{1,76}/g, '$&\r\n')
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`)

export interface Mail {
  to: string
  bcc?: string
  subject: string
  body: string
  attachment?: { name: string; blob: Blob }
}

export function buildMime(m: Mail, attachmentB64?: string) {
  const boundary = `jfv${Math.random().toString(36).slice(2)}`
  const lines = [`To: ${m.to}`, ...(m.bcc ? [`Bcc: ${m.bcc}`] : []), `Subject: ${header(m.subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '']
  lines.push(`--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap(b64utf8(m.body)))
  if (m.attachment && attachmentB64) {
    lines.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${header(m.attachment.name)}"`,
      `Content-Disposition: attachment; filename="${header(m.attachment.name)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap(attachmentB64),
    )
  }
  lines.push(`--${boundary}--`)
  return lines.join('\r\n')
}

export async function sendMail(m: Mail) {
  const att = m.attachment ? b64(new Uint8Array(await m.attachment.blob.arrayBuffer())) : undefined
  const raw = b64utf8(buildMime(m, att)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await api('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
}
