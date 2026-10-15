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

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(DEMO ? null : undefined)

  useEffect(() => {
    if (DEMO) return
    supabase!.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!DEMO && !session) return <Login />

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
