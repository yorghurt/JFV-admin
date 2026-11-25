-- Contactpersonen per klant. Plak in Supabase > SQL Editor > Run (veilig om vaker te draaien).
alter table clients add column if not exists contacts jsonb default '[]'::jsonb;

-- Bestaande "t.a.v."-namen worden de eerste contactpersoon
update clients
set contacts = jsonb_build_array(trim(regexp_replace(contact, '^t\.?a\.?v\.?\s*', '', 'i')))
where coalesce(contact, '') <> '' and coalesce(jsonb_array_length(contacts), 0) = 0;

-- LBL: vier contactpersonen
update clients
set contacts = '["Diana Kobus", "Lois Verweij", "Marieke van Sonsbeek", "Pien Suppers"]'::jsonb
where name ilike 'LBL%';

notify pgrst, 'reload schema';

-- Controle
select name, contacts from clients order by name;
