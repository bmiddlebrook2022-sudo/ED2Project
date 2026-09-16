# Movie Watchlist

Movie Watchlist is a personal cinema log. Sign in, save movies you want to see, rate them, and track what you have already watched. Each account has its own private list.

Link to deployed website: https://ed2projectbmiddlebrook2022.netlify.app

Youtube video demonstration: https://youtu.be/Nyih7u5vExY?si=VpCv_0h7Eia7jD_1 

## What it does

After you create an account, you get a dashboard with counts for total movies, watched, and still to watch.

You can add a movie by typing the details yourself, or search the movie database to fill in the title, year, genre, IMDb rating, poster, and plot. Ratings can be decimals such as `8.7/10`. Each entry can be marked plan to watch, watching, or watched, plus optional notes.

From the list you can edit a movie, delete it, or toggle watched. Your data is stored in Supabase, so it is still there the next time you sign in. Row Level Security keeps one user’s movies hidden from everyone else.

## Stack

- React and Vite for the app
- Supabase Auth for register, sign in, and sign out
- Supabase Postgres (`movie_watchlist`) for storage
- OMDB for title search and posters

## Setup

1. Copy `.env.example` to your `.env` and set your own credentials:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OMDB_API_KEY` (needed for search and posters)

2. In the Supabase SQL Editor, run `supabase-schema.sql`. That creates the table, grants signed-in users access, and enables the security policies.

3. Start the app:

```bash
npm install
npm run dev
```

4. Open the local URL Vite prints in the terminal.

