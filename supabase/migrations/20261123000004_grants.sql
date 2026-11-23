-- Table access for signed-in users. Newer Supabase projects don't grant this automatically.
-- Row-level security still decides which rows each person can see or change.
-- Logged-out visitors (anon) get no table access at all.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
