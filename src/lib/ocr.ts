import { round2 } from './calc'

export interface Parsed {
  text: string
  date: string | null
  supplier: string
  number: string
  total: number | null
  vat: number | null
  excl: number | null
}

type PdfItem = { str: string; transform: number[] }

/**
 * Tekstregels opbouwen op positie (boven → onder, links → rechts), los van de volgorde in het PDF-bestand.
 * Zo blijven "Subtotaal : € 85,00" en "TOTAAL te voldoen : € 102,85" op één regel.
 */
export function itemsToText(items: PdfItem[]) {
  const rows: { y: number; items: { x: number; s: string }[] }[] = []
  for (const it of items) {
    if (!it.str.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) <= 4)
    if (row) row.items.push({ x, s: it.str })
    else rows.push({ y, items: [{ x, s: it.str }] })
  }
  return (
    rows
      .sort((a, b) => b.y - a.y)
      .map((r) =>
        r.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .join('\n') + '\n'
  )
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Word-document (.docx): alleen echte tekst (<w:t>) per alinea; kop/voettekst (eigen gegevens) overslaan. */
export function docxXmlToText(xml: string) {
  const out: string[] = []
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
    let line = ''
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) line += m[1] !== undefined ? decodeXml(m[1]) : ' '
    line = line.replace(/\s+/g, ' ').trim()
    if (line) out.push(line)
  }
  return out.join('\n') + '\n'
}

async function docxToText(file: File) {
  const { unzipSync, strFromU8 } = await import('fflate')
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => f.name === 'word/document.xml' })
  return docxXmlToText(strFromU8(files['word/document.xml']))
}

/** "Factuur 202611 LBL.pdf" → { number: '202611', client: 'LBL' } */
export function parseFilename(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ')
  const m = base.match(/(?:^|[\s-])(20\d{4})(?:-O)?(?:\s*[-–]\s*|\s+)(.*)$/i)
  if (!m) return { number: '', client: '' }
  return { number: m[1], client: m[2].replace(/\s+/g, ' ').trim() }
}

async function pdfToTextOrCanvas(file: File): Promise<{ text: string; canvas: HTMLCanvasElement | null }> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += itemsToText(content.items as PdfItem[])
    text += '\n'
  }
  if (text.replace(/\s/g, '').length > 30) return { text, canvas: null }
  // Gescande PDF: eerste pagina renderen voor OCR
  const page = await pdf.getPage(1)
  const vp = page.getViewport({ scale: 2.5 })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
  return { text: '', canvas }
}

async function ocr(img: File | HTMLCanvasElement, onProgress?: (p: number) => void) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('nld+eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr/lang',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  const { data } = await worker.recognize(img)
  await worker.terminate()
  return data.text
}

/**
 * Telefoonfoto's: EXIF-rotatie toepassen, verkleinen tot max 2400px, grijstinten + contrast.
 * Tesseract negeert EXIF-rotatie, waardoor gedraaide foto's anders onleesbaar zijn.
 */
async function prepareImage(file: File): Promise<File | HTMLCanvasElement> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    let min = 255
    let max = 0
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = g
      if (g < min) min = g
      if (g > max) max = g
    }
    const range = Math.max(1, max - min)
    for (let i = 0; i < d.length; i += 4) {
      const v = ((d[i] - min) / range) * 255
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  } catch {
    return file // bijv. HEIC buiten Safari: Tesseract het origineel laten proberen
  }
}

export async function readDocument(file: File, onProgress?: (p: number) => void): Promise<Parsed> {
  let text = ''
  if (/\.docx$/i.test(file.name)) {
    text = await docxToText(file)
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const r = await pdfToTextOrCanvas(file)
    text = r.canvas ? await ocr(r.canvas, onProgress) : r.text
  } else {
    text = await ocr(await prepareImage(file), onProgress)
  }
  return parseText(text)
}

const AMOUNT = /(?:€|eur)?\s*(-?\d{1,3}(?:[.\s]\d{3})*,\d{2}|-?\d+[.,]\d{2})(?!\d)/gi

export function toNumber(s: string) {
  const t = s.replace(/\s/g, '')
  // 1.234,56 of 1234,56 (NL) vs 1234.56 (EN)
  if (/,\d{2}$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  return Number(t.replace(/,/g, ''))
}

function amountsIn(line: string) {
  return [...line.matchAll(AMOUNT)].map((m) => toNumber(m[1])).filter((n) => !isNaN(n))
}

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

function findDate(lines: string[]): string | null {
  const re = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/
  const reLong = new RegExp(`(\\d{1,2})\\s+(${MONTHS.join('|')}|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)[a-z]*\\.?\\s+(\\d{4})`, 'i')
  const iso = /(\d{4})-(\d{2})-(\d{2})/
  const tryLine = (l: string) => {
    let m = l.match(re)
    if (m) {
      const y = m[3].length === 2 ? `20${m[3]}` : m[3]
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
    m = l.match(iso)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    m = l.match(reLong)
    if (m) {
      const idx = MONTHS.findIndex((mo) => mo.startsWith(m![2].toLowerCase().slice(0, 3)))
      return `${m[3]}-${String(idx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
    return null
  }
  const preferred = lines.filter((l) => /factuurdatum|datum|date/i.test(l) && !/verval|due/i.test(l))
  for (const l of [...preferred, ...lines]) {
    const d = tryLine(l)
    if (d && !isNaN(Date.parse(d))) return d
  }
  return null
}

export function parseText(text: string): Parsed {
  const lines = text.split('\n').map((l) => l.replace(/[​ ]/g, ' ').trim()).filter(Boolean)

  const lastAmount = (pred: (l: string) => boolean) => {
    for (const l of lines.filter(pred).reverse()) {
      const a = amountsIn(l)
      if (a.length) return a[a.length - 1]
    }
    return null
  }

  let total = lastAmount((l) => /(totaal|total|te voldoen|te betalen|amount due)/i.test(l) && !/sub/i.test(l) && !/excl/i.test(l))
  let vat = lastAmount((l) => /(btw|vat|tax)/i.test(l) && !/(nr|nummer|number|id|-?nr\.?:)/i.test(l.replace(/\d.*$/, '')) && !/totaal|total/i.test(l))
  let excl = lastAmount((l) => /(subtotaal|subtotal|excl|netto|bedrag ex)/i.test(l))

  if (total === null) {
    const all = lines.flatMap(amountsIn)
    total = all.length ? Math.max(...all) : null
  }
  if (total !== null && excl !== null && vat === null) vat = round2(total - excl)
  if (total !== null && vat !== null && excl === null) excl = round2(total - vat)
  if (total !== null && vat === null && excl === null) {
    excl = round2(total / 1.21)
    vat = round2(total - excl)
  }

  const numLine = text.match(/(?:factuurnummer|factuurnr\.?|invoice\s*(?:no\.?|number|#)|nummer)\s*[:.#]?\s*:?\s*([A-Z0-9][A-Z0-9-/]{2,})/i)
  const supplier = lines.find((l) => /[a-z]{3,}/i.test(l) && !/^(factuur|invoice|offerte)$/i.test(l)) || ''

  return { text, date: findDate(lines), supplier, number: numLine?.[1] || '', total, vat, excl }
}
