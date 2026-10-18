-- Klanten uit de geïmporteerde facturen van 2026 aanmaken en koppelen.
-- Plak in Supabase > SQL Editor > New query > Run. Veilig om vaker te draaien.

with u as (select id from auth.users order by created_at limit 1)
insert into clients (user_id, name, contact, address, postal_city)
select u.id, c.name, c.contact, c.address, c.postal_city
from u, (values
  ('LBL Communicatie & Contentmarketing B.V.', '', 'Coehoornstraat 70-2', '6811 LA  Arnhem'),
  ('Medify Media B.V.', 't.a.v. Ewout Sinkeldam', 'Prins Hendrikstraat 15', '5953 ES  Reuver')
) as c(name, contact, address, postal_city)
where not exists (select 1 from clients x where x.user_id = u.id and x.name = c.name);

-- Facturen koppelen aan de klant (op naam: "LBL…" en "Medify…")
update documents d
set client_id = c.id,
    client_snapshot = jsonb_build_object('name', c.name, 'contact', c.contact, 'address', c.address, 'postal_city', c.postal_city, 'email', c.email)
from clients c
where d.user_id = c.user_id
  and d.client_id is null
  and split_part(lower(coalesce(d.client_snapshot->>'name', '')), ' ', 1) = split_part(lower(c.name), ' ', 1);

-- Controle
select d.number, d.client_snapshot->>'name' as klant, d.total
from documents d where d.doc_type = 'factuur' order by d.number;
