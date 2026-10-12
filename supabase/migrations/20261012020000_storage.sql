-- Private bucket for request photos and payment receipts.
-- Files live under "<unit code>/<file>", so a resident can only reach their own unit's folder.
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict (id) do nothing;

drop policy if exists "unit uploads" on storage.objects;
create policy "unit uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select public.my_units()));
drop policy if exists "unit file reads" on storage.objects;
create policy "unit file reads" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and ((storage.foldername(name))[1] in (select public.my_units()) or public.is_manager()));
