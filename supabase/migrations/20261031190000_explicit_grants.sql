-- Explicit table privileges for the Data API roles.
-- The project runs with "Automatically expose new tables" off, so nothing is reachable
-- through the API unless granted here. Row level security still decides which rows.
-- No role gets DELETE: records are closed or canceled, never removed through the API.

-- Website visitors: add a lead, read a sticker's label. Nothing else.
grant usage on schema public to anon, authenticated, service_role;
grant insert on public.leads to anon;
grant execute on function public.qr_label(uuid) to anon;

-- Signed-in users (staff and clients); policies limit each to their own rows
grant select, insert, update on
  public.staff, public.organizations, public.org_members, public.sites, public.systems,
  public.leads, public.jobs, public.notes
to authenticated;
grant select on public.invoices, public.ops_today, public.portal_summary to authenticated;
grant usage on sequence public.job_number_seq to authenticated;
grant execute on function public.is_staff(), public.my_orgs(), public.convert_lead(uuid, text), public.qr_label(uuid) to authenticated;

-- Server functions (billing, invitations) run as service_role
grant select, insert, update on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;
grant execute on function public.user_id_by_email(text) to service_role;
