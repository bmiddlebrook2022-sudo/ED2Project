create table if not exists public.movie_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  genre text not null default 'General',
  year integer,
  rating numeric(2,1),
  status text not null default 'plan_to_watch' check (status in ('plan_to_watch', 'watching', 'watched')),
  watched boolean not null default false,
  notes text,
  poster_url text,
  imdb_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movie_watchlist enable row level security;

create policy "Users can view their own movies"
on public.movie_watchlist
for select
using (auth.uid() = user_id);

create policy "Users can insert their own movies"
on public.movie_watchlist
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own movies"
on public.movie_watchlist
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own movies"
on public.movie_watchlist
for delete
using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
before update on public.movie_watchlist
for each row
execute function public.handle_updated_at();
