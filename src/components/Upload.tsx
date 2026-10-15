import { useRef, useState } from 'react'
import { readDocument, type Parsed } from '../lib/ocr'

export function UploadDrop({ onParsed }: { onParsed: (p: Parsed, file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)

  async function handle(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      onParsed(await readDocument(file, setProgress), file)
    } catch (e) {
      console.error(e)
      setError('Uitlezen mislukt. Vul de gegevens handmatig in.')
      onParsed({ text: '', date: null, supplier: '', number: '', total: null, vat: null, excl: null }, file)
    }
    setBusy(false)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        handle(e.dataTransfer.files[0])
      }}
      onClick={() => !busy && ref.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300 hover:border-neutral-400'}`}
    >
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {busy ? (
        <div>
          <p className="text-sm font-medium">Document wordt gelezen…</p>
          <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-neutral-900 transition-all" style={{ width: `${Math.max(5, progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium">Sleep een PDF of foto hierheen</p>
          <p className="mt-1 text-xs text-neutral-500">of tik om een bestand te kiezen / foto te maken</p>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
