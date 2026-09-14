# ReelSaver Backend

Flask API powering ReelSaver's yt-dlp downloads, using the application-factory
pattern with feature-split blueprints.

## Structure

```
backend/
├─ app/
│  ├─ __init__.py          # create_app() factory
│  ├─ config.py            # env-driven configuration
│  ├─ extensions.py        # db, login_manager, limiter, cors, migrate
│  ├─ models/              # SQLAlchemy models (User, Download, Setting, Template)
│  ├─ auth/                # login/register/logout + Google OAuth + decorators
│  ├─ api/                 # feature blueprints (downloads, history, settings, ...)
│  └─ services/            # security, settings, yt-dlp, download engine
├─ migrations/             # Alembic migrations (Flask-Migrate)
├─ wsgi.py                 # entry point (create_app)
├─ pyproject.toml
└─ Dockerfile
```

## Local development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .

export FLASK_APP=wsgi.py
export DATABASE_URL="sqlite:///dev.db"   # or your Supabase URL
export ADMIN_USERS="you@example.com"

flask db upgrade        # apply migrations
python wsgi.py          # runs on http://localhost:8000
```

## Migrations

```bash
flask db migrate -m "describe change"   # autogenerate from model changes
flask db upgrade                        # apply
flask db downgrade                      # revert last
```

## Environment variables

See `../.env.example` for the full list. Required in production:
`SESSION_SECRET`, `SUPABASE_DATABASE_URL`, `FLASK_ENV=production`, `ADMIN_USERS`.
