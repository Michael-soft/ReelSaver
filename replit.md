# Seal - Web Video & Audio Downloader

## Overview

A full-stack web application that replicates the Seal Android app's core features. Users can download video and audio from YouTube, Twitter, Instagram, and 1000+ platforms powered by **yt-dlp**. Authentication is provided via Replit Auth (OpenID Connect).

## Architecture

- **Frontend**: React + Vite + TypeScript, running on port 5000
- **Backend**: Python Flask API, running on port 8000 (via `main.py`)
- **Database**: PostgreSQL (via DATABASE_URL env var) using SQLAlchemy ORM
- **Auth**: Replit Auth (OpenID Connect) via Flask-Dance + Flask-Login
- **Downloader**: yt-dlp (Python package) for actual media downloading
- **Downloads stored**: `downloads/` directory

## Key Features

1. **Auth** — Replit Auth login/logout with user avatar/name in nav; landing page for logged-out users
2. **Download page** — Paste URL, fetch video info, select format/quality, download
3. **Playlist page** — Fetch playlist items, select specific videos, bulk download
4. **History page** — Searchable download history with filtering, bulk delete
5. **Command page** — Custom yt-dlp flags, save/load command templates
6. **Settings page** — Proxy, rate limit, concurrent downloads, embed options

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
  app.py                # Flask app factory: DB, CORS, ProxyFix, SQLAlchemy setup
  models.py             # SQLAlchemy models: User, OAuth, Download, Setting, Template
  replit_auth.py        # Replit Auth blueprint, login/logout, require_login decorator
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
- `GET /auth/login` — Start Replit Auth login flow
- `GET /auth/logout` — Logout + redirect to Replit OIDC end_session

## Auth Flow

1. Unauthenticated users see a landing page with "Log in to continue" button
2. Clicking the button goes to `/auth/login` → Replit OIDC → callback
3. After login, user is saved/upserted in PostgreSQL `users` table
4. `current_user` is available via Flask-Login; all `/api/*` routes use `@require_login`
5. Nav bar shows user avatar, name, and a "Log out" link

## Workflows

- **Start application**: `cd web && npm run dev` (port 5000, webview)
- **Backend API**: `python main.py` (port 8000, console)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Flask session secret (auto-provisioned)
- `REPL_ID` — Replit Repl ID (auto-injected by Replit, used as OIDC client_id)

## Android Repository

The original Seal Android app source code is also in this repo:
- `app/` — Android Kotlin source code
- `buildSrc/` — Gradle build logic
- `color/` — Dynamic color library module
- Java GraalVM 22.3 is installed for Gradle builds
