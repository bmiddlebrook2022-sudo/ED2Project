# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Movie Watchlist

A simple movie watchlist app built with React + Vite and connected to Supabase for authentication and persistent watchlist storage.

## Features

- Register, sign in, and sign out with Supabase Auth
- CRUD for movies in a personal watchlist
- Mark movies as watched or plan-to-watch
- Edit and delete entries from the dashboard
- Real-time session handling using Supabase

## Setup

1. Copy `.env.example` to `.env` and fill in your Supabase project values.
2. Open the Supabase SQL Editor and run the full script in `supabase-schema.sql`. That script creates the table, grants signed-in users access, sets Row Level Security policies, and allows ratings such as `8.7`.

3. Start the app:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

4. Open the local Vite URL shown in the terminal.

## Notes

The project is already configured to use the values in `.env` if they are present. The app will show a warning if Supabase is not configured yet.
