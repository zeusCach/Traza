create table public.profile_photos (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  jpeg_base64 text check (
    jpeg_base64 is null or (
      char_length(jpeg_base64) between 8 and 350000
      and char_length(jpeg_base64) % 4 = 0
      and jpeg_base64 ~ '^/9j/[A-Za-z0-9+/]*={0,2}$'
    )
  )
);

alter table public.profile_photos enable row level security;
revoke all on public.profile_photos from public, anon, authenticated;
grant select, insert, update on public.profile_photos to authenticated;

create policy "Read own profile photo" on public.profile_photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own profile photo" on public.profile_photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own profile photo" on public.profile_photos
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
