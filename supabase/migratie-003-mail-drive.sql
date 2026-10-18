-- Mail + Google Drive. Plak in Supabase > SQL Editor > Run.
alter table settings add column if not exists drive_invoices_id text;
alter table settings add column if not exists drive_invoices_name text;
alter table settings add column if not exists drive_receipts_id text;
alter table settings add column if not exists drive_receipts_name text;
alter table settings add column if not exists mail_bcc text;
alter table settings add column if not exists mail_invoice_subject text;
alter table settings add column if not exists mail_invoice_body text;
alter table settings add column if not exists mail_quote_subject text;
alter table settings add column if not exists mail_quote_body text;
alter table settings add column if not exists mail_reminder_subject text;
alter table settings add column if not exists mail_reminder_body text;
alter table documents add column if not exists sent_at timestamptz;
alter table documents add column if not exists reminded_at timestamptz;
