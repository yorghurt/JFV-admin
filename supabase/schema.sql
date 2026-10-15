-- JFV Administratie — databaseschema
-- Plak dit volledig in Supabase > SQL Editor > New query > Run.

create extension if not exists "pgcrypto";

-- Instellingen (één rij per gebruiker)
create table if not exists settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  company_name text default 'Jorg Foto & Video',
  owner_name text default 'Jorg van Gerner',
  address text default 'Haringvliet 59',
  postal_city text default '6826 VB  Arnhem',
  phone text default '+31 (0) 6 128 321 58',
  email text default '',
  kvk text default '61085944',
  vat_number text default 'NL002256165B83',
  iban text default 'NL42 ASNB 8850 5150 49',
  payment_days int default 14,
  quote_valid_days int default 30,
  rental_note text default E'Toelichting: De minimale huurtijd is 0,5 dag.\nHuur van apparatuur door LBL wordt alleen gefactureerd in het geval het een betaalde fotografie opdracht voor een klant betreft. Bij overige opdrachten vindt overleg plaats wat betreft de huur van apparatuur.',
  rental_list_url text default '',
  updated_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  contact text default '',
  address text default '',
  postal_city text default '',
  email text default '',
  created_at timestamptz default now()
);

-- Producten / diensten. kind: fotografie | video | apparatuur
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('fotografie','video','apparatuur')),
  name text not null,
  description text default '',
  unit text not null default 'dagdeel' check (unit in ('dagdeel','dag')),
  price numeric(12,2) not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Facturen en offertes in één tabel. doc_type: factuur | offerte
-- status factuur: concept | verzonden | betaald
-- status offerte: concept | verzonden | geaccepteerd | afgewezen
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  doc_type text not null check (doc_type in ('factuur','offerte')),
  number text,
  status text not null default 'concept',
  client_id uuid references clients on delete set null,
  client_snapshot jsonb default '{}'::jsonb,
  issue_date date not null default current_date,
  due_date date,
  project_name text default '',
  po_number text default '',
  note text default '',
  show_rental_link boolean default false,
  lines jsonb not null default '[]'::jsonb,
  vat_rate numeric(5,2) not null default 21,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  imported boolean default false,
  file_path text,
  source_quote_id uuid references documents on delete set null,
  paid_at date,
  created_at timestamptz default now(),
  unique (user_id, doc_type, number)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null default current_date,
  supplier text default '',
  description text default '',
  category text not null default 'Overig',
  amount_excl numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  file_path text,
  created_at timestamptz default now()
);

-- Row Level Security: alleen eigen gegevens
alter table settings enable row level security;
alter table clients enable row level security;
alter table products enable row level security;
alter table documents enable row level security;
alter table expenses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','clients','products','documents','expenses'] loop
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Bestandsopslag (inkoopfacturen, geïmporteerde facturen)
insert into storage.buckets (id, name, public) values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists own_files on storage.objects;
create policy own_files on storage.objects for all
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
