import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { DEMO, supabase } from './lib/db'
import { StoreProvider } from './lib/store'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { DocList } from './pages/DocList'
import { DocEdit } from './pages/DocEdit'
import { Expenses } from './pages/Expenses'
import { Reports } from './pages/Reports'
import { Clients } from './pages/Clients'
import { Products } from './pages/Products'
import { SettingsPage } from './pages/Settings'
import { SetPassword } from './pages/SetPassword'

// Resetlink uit de mail: Supabase zet type=recovery in de URL (voordat het die opruimt)
const FROM_RESET_LINK = /type=recovery/.test(window.location.hash + window.location.search)

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(DEMO ? null : undefined)
  const [recovery, setRecovery] = useState(FROM_RESET_LINK)

  useEffect(() => {
    if (DEMO) return
    supabase!.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase!.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!DEMO && !session) return <Login />
  if (!DEMO && recovery) return <SetPassword onDone={() => setRecovery(false)} />

  return (
    <StoreProvider key={session?.user.id || 'demo'}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="facturen" element={<DocList type="factuur" />} />
            <Route path="facturen/:id" element={<DocEdit type="factuur" />} />
            <Route path="offertes" element={<DocList type="offerte" />} />
            <Route path="offertes/:id" element={<DocEdit type="offerte" />} />
            <Route path="uitgaven" element={<Expenses />} />
            <Route path="rapportages" element={<Reports />} />
            <Route path="klanten" element={<Clients />} />
            <Route path="producten" element={<Products />} />
            <Route path="instellingen" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
