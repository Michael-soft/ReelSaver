# ReelSaver — Project Layout

This repository contains the **ReelSaver web application** (a yt-dlp powered
video/audio downloader) alongside the upstream **Seal** Android app it was
based on.

## Top-level layout

```
.
├─ backend/          # Flask API (application factory, blueprints, services, Alembic)
├─ frontend/         # React + Vite + TypeScript SPA (served by nginx in prod)
├─ docker-compose.yml# backend + frontend + redis
├─ .env.example      # environment variable template
│
├─ app/  buildSrc/  gradle/  fastlane/  …   # Upstream Seal Android app (Kotlin)
└─ README.md         # Seal (Android) README
```

> The Android app (Seal) is upstream and largely independent. The web product
> lives entirely in `backend/` and `frontend/`.

## Running the web app

### Docker (recommended)

```bash
cp .env.example .env      # then fill in real values
docker compose up --build
# frontend → http://localhost:5000   (proxies /api and /auth to backend)
```

Apply database migrations once (against your Supabase/Postgres DB):

```bash
docker compose run --rm backend flask db upgrade
```

### Manual

```bash
# Backend
cd backend
pip install -e .
export FLASK_APP=wsgi.py
flask db upgrade
python wsgi.py            # http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5000
```

## Environment variables

See `.env.example`. Required in production: `SESSION_SECRET`,
`SUPABASE_DATABASE_URL`, `FLASK_ENV=production`, `ADMIN_USERS`.
Recommended: `CORS_ORIGINS`, `RATELIMIT_STORAGE_URI` (Redis).

## Migrating from the old layout

The previous `server/` + `web/` + root `main.py` layout has been replaced by
`backend/` + `frontend/`. Schema is now managed with Alembic instead of
`db.create_all()`. Run `flask db upgrade` to create/upgrade tables.
