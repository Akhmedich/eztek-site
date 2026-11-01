-- Photos and plans attached to a website request, in a private Storage bucket.
-- The browser picks the lead id, adds the lead, then uploads to lead-files/<lead id>/<file>.
-- Only staff can read the files; nobody can change or remove them through the API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-files', 'lead-files', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

-- A folder accepts files only for a lead added in the last hour, up to 10 per lead, and the whole
-- site takes at most 20 uploads an hour and 40 a day (5 MB each: at worst 200 MB a day of the free
-- 1 GB). Files cannot be removed through the API; staff clear old ones in the dashboard.
create function public.lead_accepts_files(p_folder text) returns boolean language sql stable security definer set search_path = '' as $$
  select p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (select 1 from public.leads where id = p_folder::uuid and created_at > now() - interval '1 hour')
    and (select count(*) from storage.objects where bucket_id = 'lead-files' and name like p_folder || '/%') < 10
    and (select count(*) from storage.objects where bucket_id = 'lead-files' and created_at > now() - interval '1 hour') < 20
    and (select count(*) from storage.objects where bucket_id = 'lead-files' and created_at > now() - interval '1 day') < 40;
$$;
revoke execute on function public.lead_accepts_files(text) from public;
grant execute on function public.lead_accepts_files(text) to anon, authenticated;

create policy lead_files_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'lead-files' and public.lead_accepts_files((storage.foldername(name))[1]));
create policy lead_files_staff on storage.objects for select to authenticated
  using (bucket_id = 'lead-files' and public.is_staff());
