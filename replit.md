# ReelSaver - Web Video & Audio Downloader

## Overview

A full-stack web application that lets users download video and audio from YouTube, Twitter, Instagram, and 1000+ platforms powered by **yt-dlp**. Authentication uses local username/password (werkzeug hashed) plus Google OAuth (Flask-Dance).

## Architecture

- **Frontend**: React + Vite + TypeScript, running on port 5000
- **Backend**: Python Flask API, running on port 8000 (via `main.py`)
- **Database**: Supabase PostgreSQL (via `SUPABASE_DATABASE_URL`, Session pooler) using SQLAlchemy ORM
- **Auth**: Local username/password + Google OAuth (Flask-Dance + Flask-Login)
- **Downloader**: yt-dlp (Python package) for actual media downloading
- **Downloads stored**: `downloads/` directory

## Key Features

1. **Auth** — Register/login with username + password OR "Continue with Google"; landing page for logged-out users
2. **Download page** — Paste URL, fetch video info, select format/quality, download
3. **Playlist page** — Fetch playlist items, select specific videos, bulk download
4. **Watermark remover** — Dedicated page that downloads short-form video (TikTok/IG/X/FB/Snap) without the platform's burned-in overlay (`noWatermark` flag → yt-dlp extractor args)
5. **History page** — Searchable download history with filtering, bulk delete
6. **Command page** — Custom yt-dlp flags, save/load command templates
7. **Settings page** — Proxy, rate limit, concurrent downloads, embed options
8. **Mobile responsive** — Sidebar collapses into a slide-in drawer with hamburger toggle below 900px

## Project Structure

```
web/                    # React + Vite frontend
  src/
    api/client.ts       # API client with type definitions
    components/         # Reusable UI components (Layout, VideoInfoCard, etc.)
    pages/              # Route pages (Download, Playlist, History, Settings, Command, LandingPage)
    App.tsx             # Router setup + auth state
    main.tsx            # Entry point with React Query
    index.css           # Global styles + CSS custom properties
  vite.config.ts        # Vite config with Tailwind + proxy to backend (/api + /auth)

server/
  app.py                # Flask app factory: DB (Supabase), CORS, ProxyFix, SQLAlchemy setup
  models.py             # SQLAlchemy models: User, Download, Setting, Template
  auth.py               # Auth blueprint: register/login/logout + Google OAuth
  routes.py             # All API routes (/api/me, /api/info, /api/download, etc.)

main.py                 # Entry point: imports server/app.py + server/routes.py, runs Flask

downloads/              # Where downloaded files are saved
```

## API Endpoints

- `GET /api/me` — Returns current user info (or null if not logged in)
- `GET /api/info?url=` — Fetch video info (auth required)
- `GET /api/playlist?url=` — Fetch playlist items (auth required)
- `POST /api/download` — Start a download (auth required)
- `GET /api/progress/:taskId` — SSE stream for download progress (auth required)
- `GET/DELETE /api/history` — Download history (auth required)
- `GET /api/stats` — Dashboard statistics (auth required)
- `GET/POST /api/settings` — User settings (auth required)
- `GET/POST/DELETE /api/templates` — Command templates (auth required)
- `POST /api/command` — Run custom yt-dlp command (auth required)
- `GET /api/files/:filename` — Serve downloaded files (auth required)
- `POST /auth/register` — Create account (username, email, password)
- `POST /auth/login` — Username/password login
- `POST /auth/logout` — Logout
- `GET /auth/google` — Start Google OAuth flow
- `GET /auth/google/authorized` — Google OAuth callback

## Auth Flow

1. Unauthenticated users see the landing page with login/register form + "Continue with Google" button.
2. Local auth: `POST /auth/register` or `POST /auth/login` returns the user JSON and sets the session cookie.
3. Google OAuth: `/auth/google` → Google consent → `/auth/google/authorized` → user is upserted by `google_id` and signed in.
4. `current_user` is available via Flask-Login; all `/api/*` routes use `@require_login`.
5. Nav bar shows username and a "Log out" button.

## Workflows

- **Start application**: `cd web && npm run dev` (port 5000, webview)
- **Backend API**: `python main.py` (port 8000, console)

## Environment Variables / Secrets

- `SUPABASE_DATABASE_URL` — Supabase Session pooler PostgreSQL connection string
- `SESSION_SECRET` — Flask session secret
- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` — Google OAuth client secret
- `GITHUB_TOKEN` — Used for pushing code to https://github.com/Michael-soft/ReelSaver via REST API

## Google OAuth Setup

The OAuth callback URL is `/auth/google/authorized`. Whitelist these in your Google Cloud Console under "Authorized redirect URIs":
- `https://<your-replit-dev-domain>/auth/google/authorized` (development)
- `https://<your-deployment-domain>/auth/google/authorized` (production)

## GitHub Repository

Source is mirrored to https://github.com/Michael-soft/ReelSaver (main branch). Pushes are made via the GitHub REST API using `GITHUB_TOKEN` because destructive git operations are blocked locally.
