import { useState } from 'react'
import { fillTemplate, mailTemplate, pdfBlob, pdfFileName, type MailKind } from '../lib/docs'
import { GOOGLE_ENABLED, sendMail } from '../lib/google'
import type { Doc, Settings } from '../lib/types'
import { Button, Field, Input, Modal, Textarea } from './ui'

const TITLE: Record<MailKind, string> = { invoice: 'Factuur mailen', quote: 'Offerte mailen', reminder: 'Herinnering mailen' }

/**
 * Mail via Gmail met PDF als bijlage. `prepare` maakt de factuur zo nodig eerst definitief
 * en geeft het document terug zoals het verstuurd wordt.
 */
export function MailModal({
  doc,
  kind,
  settings,
  creditedNumber,
  prepare,
  onSent,
  onClose,
}: {
  doc: Doc
  kind: MailKind
  settings: Settings
  creditedNumber?: string | null
  prepare: () => Promise<Doc>
  onSent: (sent: Doc, to: string) => Promise<void>
  onClose: () => void
}) {
  const tpl = mailTemplate(kind, settings)
  // Concept heeft nog geen nummer: placeholder blijft staan tot verzenden
  const [to, setTo] = useState(doc.client_snapshot.email || '')
  const [bcc, setBcc] = useState(settings.mail_bcc)
  const [subject, setSubject] = useState(doc.number ? fillTemplate(tpl.subject, doc, settings) : tpl.subject)
  const [body, setBody] = useState(doc.number ? fillTemplate(tpl.body, doc, settings) : fillTemplate(tpl.body, { ...doc, number: '{nummer}' }, settings))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setError('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) return setError('Vul een geldig e-mailadres in.')
    setBusy(true)
    try {
      const d = await prepare()
      const fill = (t: string) => fillTemplate(t, d, settings)
      await sendMail({
        to: to.trim(),
        bcc: bcc.trim() || undefined,
        subject: fill(subject),
        body: fill(body),
        attachment: { name: pdfFileName(d), blob: await pdfBlob(d, settings, creditedNumber) },
      })
      await onSent(d, to.trim())
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Modal title={TITLE[kind]} onClose={onClose} wide>
      {!GOOGLE_ENABLED ? (
        <p className="text-sm text-stone-600">Google is nog niet gekoppeld. Volg de stappen in de README (VITE_GOOGLE_CLIENT_ID).</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aan">
              <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="klant@bedrijf.nl" autoFocus={!to} />
            </Field>
            <Field label="Bcc (kopie aan jezelf)">
              <Input type="email" value={bcc} onChange={(e) => setBcc(e.target.value)} />
            </Field>
          </div>
          <Field label="Onderwerp">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Bericht">
            <Textarea rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <p className="text-xs text-stone-500">
            Bijlage: {pdfFileName(doc)} · verstuurd vanaf je Gmail
            {doc.status === 'concept' && doc.doc_type === 'factuur' && ' · factuur wordt bij verzenden definitief gemaakt'}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button variant="primary" onClick={send} disabled={busy}>
              {busy ? 'Versturen…' : 'Versturen'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
