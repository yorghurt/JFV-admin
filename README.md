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

### 3. Google (Drive + Gmail)
Eenmalig. Een bestaand Google Cloud-project (bijv. van een andere app) mag je hergebruiken.
1. https://console.cloud.google.com → kies/maak project.
2. **APIs & Services → Library**: zet **Google Drive API** en **Gmail API** aan.
3. **OAuth consent screen** (Google Auth Platform → Branding/Audience):
   - User type: External · App name: JFV Administratie · support-mail: jorgvangerner@gmail.com
   - **Audience → Test users**: voeg `jorgvangerner@gmail.com` toe (status *Testing* is prima).
   - **Data access → Scopes**: `.../auth/drive` en `.../auth/gmail.send`.
4. **Clients → Create client** → *Web application*:
   - Authorized JavaScript origins: `https://jfv-admin.vercel.app` en `http://localhost:5173`
   - Geen redirect-URI nodig.
5. Kopieer de **Client ID** → Vercel → Settings → Environment Variables: `VITE_GOOGLE_CLIENT_ID` → Redeploy.
6. Supabase: draai `supabase/migratie-003-mail-drive.sql`.
7. App → Instellingen → **Verbind met Google** → kies de map voor facturen en voor bonnen.
   Google toont "Google heeft deze app niet geverifieerd" → **Doorgaan** (het is je eigen app).

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
