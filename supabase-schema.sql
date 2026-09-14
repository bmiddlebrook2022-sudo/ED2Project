-- Run this entire script in the Supabase SQL Editor.
-- It is safe to run more than once.

create table if not exists public.movie_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  genre text not null default 'General',
  year integer,
  rating numeric(3,1),
  status text not null default 'plan_to_watch' check (status in ('plan_to_watch', 'watching', 'watched')),
  watched boolean not null default false,
  notes text,
  poster_url text,
  imdb_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movie_watchlist
  add column if not exists poster_url text;

alter table public.movie_watchlist
  add column if not exists imdb_id text;

alter table public.movie_watchlist
  alter column rating type numeric(3,1);

alter table public.movie_watchlist
  alter column user_id set default auth.uid();

alter table public.movie_watchlist drop constraint if exists movie_watchlist_rating_range;
alter table public.movie_watchlist
  add constraint movie_watchlist_rating_range
  check (rating is null or (rating >= 0 and rating <= 10));

grant usage on schema public to anon, authenticated;

revoke all on table public.movie_watchlist from anon;
grant select, insert, update, delete on table public.movie_watchlist to authenticated;

alter table public.movie_watchlist enable row level security;
alter table public.movie_watchlist force row level security;

drop policy if exists "Users can view their own movies" on public.movie_watchlist;
drop policy if exists "Users can insert their own movies" on public.movie_watchlist;
drop policy if exists "Users can update their own movies" on public.movie_watchlist;
drop policy if exists "Users can delete their own movies" on public.movie_watchlist;

create policy "Users can view their own movies"
on public.movie_watchlist
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert their own movies"
on public.movie_watchlist
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their own movies"
on public.movie_watchlist
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their own movies"
on public.movie_watchlist
for delete
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.movie_watchlist;

create trigger set_updated_at
before update on public.movie_watchlist
for each row
execute procedure public.handle_updated_at();
