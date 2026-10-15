# JFV Administratie

Facturen, offertes, uitgaven en btw-overzichten voor Jorg Foto & Video.
React + Vite, data in Supabase, hosting op Vercel.

## Eenmalige setup

### 1. Supabase
1. Maak een gratis project op https://supabase.com (regio: Frankfurt/EU).
2. **SQL Editor → New query**: plak de inhoud van `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user**: maak je eigen account (e-mail + wachtwoord, "Auto confirm").
4. **Authentication → Sign In / Providers → Email**: zet **"Allow new users to sign up" uit**.
5. **Project Settings → API**: kopieer *Project URL* en *anon public key*.

### 2. Vercel
1. https://vercel.com → **Add New → Project** → importeer de GitHub-repo `JFV-admin`.
2. Framework: Vite (automatisch).
3. **Environment Variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
4. **Deploy**.

## Lokaal draaien
```
npm install
cp .env.example .env   # vul de waarden in; zonder .env draait een demo-modus
npm run dev
npm test
```

## Werkwijze
- **Eerst oude 2026-facturen importeren** (Facturen → Importeer bestaande factuur). Daarna volgt de nummering automatisch.
- Factuur krijgt pas een nummer bij **Definitief maken** (geen gaten in de reeks).
- Offertes: eigen reeks `JJJJNN-O`, geldig 30 dagen, omzetten naar factuur met één knop.
- Btw-overzicht op factuurdatum; conceptfacturen tellen niet mee.
