-- Creditfacturen. Plak in Supabase > SQL Editor > Run.
alter table documents add column if not exists credit_of uuid references documents on delete set null;
