import { NavLink, Outlet } from 'react-router-dom'
import { DEMO, supabase } from '../lib/db'
import { cx } from './ui'

const NAV = [
  ['/', 'Overzicht', '▦'],
  ['/facturen', 'Facturen', '€'],
  ['/offertes', 'Offertes', '✎'],
  ['/uitgaven', 'Uitgaven', '⇣'],
  ['/rapportages', 'Btw & rapportages', '%'],
  ['/klanten', 'Klanten', '☺'],
  ['/producten', 'Producten', '▤'],
  ['/instellingen', 'Instellingen', '⚙'],
] as const

const MOBILE = ['/', '/facturen', '/offertes', '/uitgaven', '/rapportages']

export function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-stone-200 bg-white p-4 md:flex">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-brand" />
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-wide">Administratie</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map(([to, label, icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm', isActive ? 'bg-brand-light font-medium text-ink' : 'text-stone-600 hover:bg-stone-100')
              }
            >
              <span className="w-4 text-center text-stone-400">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        {DEMO ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Demo-modus: gegevens staan alleen in deze browser.</p>
        ) : (
          <button onClick={() => supabase!.auth.signOut()} className="px-2.5 py-2 text-left text-sm text-stone-500 hover:text-ink">
            Uitloggen
          </button>
        )}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-7 w-7" />
          <span className="font-display text-xl font-bold tracking-wide">Administratie</span>
        </div>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-sm text-stone-600">Meer ▾</summary>
          <div className="absolute right-0 mt-2 w-44 rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
            {NAV.filter(([to]) => !MOBILE.includes(to)).map(([to, label]) => (
              <NavLink key={to} to={to} className="block rounded px-3 py-2 text-sm hover:bg-stone-100">
                {label}
              </NavLink>
            ))}
            {!DEMO && (
              <button onClick={() => supabase!.auth.signOut()} className="block w-full rounded px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100">
                Uitloggen
              </button>
            )}
          </div>
        </details>
      </header>

      <main className="overflow-x-hidden px-4 pb-24 pt-5 md:ml-56 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto min-w-0 max-w-5xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter(([to]) => MOBILE.includes(to)).map(([to, label, icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-ink' : 'text-stone-400')}
          >
            <span className="text-base leading-none">{icon}</span>
            {label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
