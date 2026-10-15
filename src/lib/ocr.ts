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

async function pdfToTextOrCanvas(file: File): Promise<{ text: string; canvas: HTMLCanvasElement | null }> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Regels reconstrueren op basis van y-positie
    let lastY: number | null = null
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = Math.round(item.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'
      else if (lastY !== null) text += ' '
      text += item.str
      lastY = y
    }
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
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  const { data } = await worker.recognize(img)
  await worker.terminate()
  return data.text
}

export async function readDocument(file: File, onProgress?: (p: number) => void): Promise<Parsed> {
  let text = ''
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const r = await pdfToTextOrCanvas(file)
    text = r.canvas ? await ocr(r.canvas, onProgress) : r.text
  } else {
    text = await ocr(file, onProgress)
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
