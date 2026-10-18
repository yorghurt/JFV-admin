import { useEffect, useState } from 'react'
import { ensureFolder, listFolders, type DriveItem } from '../lib/google'
import { Button, Empty, Input, Modal } from './ui'

/** Door Google Drive bladeren en een map kiezen. */
export function FolderPicker({ title, onPick, onClose }: { title: string; onPick: (f: { id: string; name: string }) => void; onClose: () => void }) {
  const [path, setPath] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'Mijn Drive' }])
  const [items, setItems] = useState<DriveItem[] | null>(null)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const cur = path[path.length - 1]

  useEffect(() => {
    setItems(null)
    listFolders(cur.id)
      .then(setItems)
      .catch((e) => setError(e.message))
  }, [cur.id])

  async function create() {
    if (!newName.trim()) return
    const id = await ensureFolder(newName.trim(), cur.id)
    setPath([...path, { id, name: newName.trim() }])
    setNewName('')
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm">
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-stone-400">/</span>}
            <button className={i === path.length - 1 ? 'font-medium' : 'text-stone-500 hover:text-ink'} onClick={() => setPath(path.slice(0, i + 1))}>
              {p.name}
            </button>
          </span>
        ))}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-stone-200">
        {items === null ? (
          <Empty>Laden…</Empty>
        ) : items.length === 0 ? (
          <Empty>Geen submappen.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((f) => (
              <li key={f.id}>
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50" onClick={() => setPath([...path, { id: f.id, name: f.name }])}>
                  <span className="text-stone-400">▸</span> {f.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nieuwe map hier…" />
        <Button onClick={create} disabled={!newName.trim()}>
          Maak
        </Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" disabled={cur.id === 'root'} onClick={() => onPick(cur)}>
          Kies "{cur.name}"
        </Button>
      </div>
    </Modal>
  )
}
