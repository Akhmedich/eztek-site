-- Fixes from the Supabase security advisor on the live project (2026-11-01).

-- Even with automatic exposure off, new tables come with TRUNCATE, TRIGGER and REFERENCES for the
-- API roles. The Data API cannot use them, but nobody needs them: SELECT/INSERT/UPDATE are granted
-- table by table in 20261031190000_explicit_grants.sql.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated, service_role;

-- Helpers for the signed-in policies; visitors never need to call them
revoke execute on function public.is_staff(), public.my_orgs() from public, anon;

-- Trigger function with a fixed search_path
alter function public.touch() set search_path = '';
