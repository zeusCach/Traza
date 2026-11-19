create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Ciclista'
    check (char_length(btrim(display_name)) between 1 and 80)
);

create function public.create_traza_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.create_traza_profile() from public, anon, authenticated;

create trigger on_auth_user_created_traza
after insert on auth.users
for each row execute function public.create_traza_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at_ms bigint not null,
  duration_ms bigint not null check (duration_ms >= 0),
  distance_m double precision check (distance_m >= 0 and distance_m < 'Infinity'::double precision),
  elevation_gain_m double precision check (elevation_gain_m >= 0 and elevation_gain_m < 'Infinity'::double precision),
  name text check (char_length(name) <= 80),
  effort text check (effort in ('normal', 'moderate', 'competitive', 'hard')),
  route jsonb not null default '[]'::jsonb check (jsonb_typeof(route) = 'array'),
  unique (owner_id, started_at_ms),
  unique (id, owner_id)
);

create table public.ride_posts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  published_at timestamptz not null default now(),
  foreign key (ride_id, author_id) references public.rides (id, owner_id) on delete cascade
);

create index ride_posts_feed_idx on public.ride_posts (published_at desc, id desc);
create index ride_posts_author_idx on public.ride_posts (author_id);

create table public.saved_posts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id uuid not null references public.ride_posts (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index saved_posts_post_idx on public.saved_posts (post_id);

alter table public.profiles enable row level security;
alter table public.rides enable row level security;
alter table public.ride_posts enable row level security;
alter table public.saved_posts enable row level security;

revoke all on public.profiles, public.rides, public.ride_posts, public.saved_posts from public, anon, authenticated;
grant select, update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.rides to authenticated;
grant update (name, effort, duration_ms, distance_m, elevation_gain_m, route) on public.rides to authenticated;
grant select, insert (ride_id), delete on public.ride_posts to authenticated;
grant select, insert (post_id), delete on public.saved_posts to authenticated;

create policy "Read profiles for the feed" on public.profiles
  for select to authenticated using (true);
create policy "Edit own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Read own and published rides" on public.rides
  for select to authenticated using (
    (select auth.uid()) = owner_id
    or exists (select 1 from public.ride_posts where ride_id = rides.id)
  );
create policy "Create own rides" on public.rides
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Edit own rides" on public.rides
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Delete own rides" on public.rides
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Read the feed" on public.ride_posts
  for select to authenticated using (true);
create policy "Publish own rides" on public.ride_posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Remove own posts" on public.ride_posts
  for delete to authenticated using ((select auth.uid()) = author_id);

create policy "Read own saved posts" on public.saved_posts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Save posts for own account" on public.saved_posts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Remove own saved posts" on public.saved_posts
  for delete to authenticated using ((select auth.uid()) = user_id);
