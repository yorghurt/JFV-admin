import { useEffect, useRef, useState } from 'react'
import { readDocument, type Parsed } from '../lib/ocr'

const EMPTY: Parsed = { text: '', date: null, supplier: '', number: '', total: null, vat: null, excl: null }

/** Bestandskiezer: meerdere PDF's/foto's tegelijk. */
export function UploadDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const pick = (list: FileList | null) => list && list.length && onFiles([...list])

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
        pick(e.dataTransfer.files)
      }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-ink bg-stone-50' : 'border-stone-300 hover:border-stone-400'}`}
    >
      <input ref={ref} type="file" multiple accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => pick(e.target.files)} />
      <p className="text-sm font-medium">Sleep PDF's, Word-bestanden of foto's hierheen</p>
      <p className="mt-1 text-xs text-stone-500">of tik om bestanden te kiezen / foto te maken · meerdere tegelijk kan</p>
    </div>
  )
}

/**
 * Wachtrij: leest bestand voor bestand uit. Het volgende bestand wordt alvast
 * op de achtergrond gelezen terwijl je het huidige controleert.
 */
export function useFileQueue() {
  const [files, setFiles] = useState<File[]>([])
  const [index, setIndex] = useState(0)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const cache = useRef(new Map<File, Promise<Parsed>>())

  const read = (f: File, onProgress?: (p: number) => void) => {
    if (!cache.current.has(f)) cache.current.set(f, readDocument(f, onProgress).catch(() => ({ ...EMPTY, failed: true }) as Parsed))
    return cache.current.get(f)!
  }

  const file = files[index] as File | undefined

  useEffect(() => {
    if (!file) return
    let live = true
    setParsed(null)
    setError('')
    setProgress(0)
    read(file, (p) => live && setProgress(p)).then((p) => {
      if (!live) return
      if ((p as Parsed & { failed?: boolean }).failed) setError('Uitlezen mislukt. Vul de gegevens handmatig in.')
      setParsed(p)
      const next = files[index + 1]
      if (next) read(next)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  return {
    file,
    parsed,
    progress,
    error,
    index,
    count: files.length,
    isLast: index >= files.length - 1,
    start: (f: File[]) => {
      cache.current.clear()
      setFiles(f)
      setIndex(0)
    },
    next: () => setIndex((i) => i + 1),
  }
}

export function QueueStatus({ index, count, progress, name }: { index: number; count: number; progress: number; name?: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium">
        {count > 1 ? `Bestand ${index + 1} van ${count} wordt gelezen…` : 'Document wordt gelezen…'}
      </p>
      {name && <p className="mt-1 truncate text-xs text-stone-500">{name}</p>}
      <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full bg-ink transition-all" style={{ width: `${Math.max(5, progress * 100)}%` }} />
      </div>
    </div>
  )
}
