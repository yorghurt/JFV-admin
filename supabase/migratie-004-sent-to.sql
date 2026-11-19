-- Naar welk adres een factuur/offerte is gemaild. Plak in Supabase > SQL Editor > Run.
alter table documents add column if not exists sent_to text;
notify pgrst, 'reload schema';
