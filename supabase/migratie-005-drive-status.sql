-- Wanneer en waar een factuur in Google Drive is gezet. Plak in Supabase > SQL Editor > Run.
alter table documents add column if not exists drive_saved_at timestamptz;
alter table documents add column if not exists drive_path text;
notify pgrst, 'reload schema';
