import os


def _bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes', 'on')


class Config:
    """Environment-driven application configuration."""

    IS_PRODUCTION = (
        os.environ.get('FLASK_ENV', '').lower() == 'production'
        or bool(os.environ.get('REPLIT_DEPLOYMENT'))
    )

    # ─── Secrets ──────────────────────────────────────────────────────────
    SESSION_SECRET = os.environ.get('SESSION_SECRET')

    # ─── Database ─────────────────────────────────────────────────────────
    _db_url = os.environ.get('SUPABASE_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if _db_url and _db_url.startswith('postgres://'):
        _db_url = 'postgresql://' + _db_url[len('postgres://'):]
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 5,
        'max_overflow': 5,
        'connect_args': {
            'sslmode': 'require',
            'connect_timeout': 10,
        },
    } if (_db_url and _db_url.startswith('postgresql')) else {}

    # ─── Sessions / cookies ───────────────────────────────────────────────
    # Secure by default; set SESSION_COOKIE_SECURE=false for local HTTP dev.
    SESSION_COOKIE_SECURE = _bool('SESSION_COOKIE_SECURE', True)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 30  # 30 days

    # ─── CORS ─────────────────────────────────────────────────────────────
    @staticmethod
    def cors_origins() -> list[str]:
        raw = os.environ.get('CORS_ORIGINS', '').strip()
        if raw:
            return [o.strip() for o in raw.split(',') if o.strip()]
        origins: list[str] = []
        domain = os.environ.get('REPLIT_DEV_DOMAIN', '').strip()
        if domain:
            origins.append(f'https://{domain}')
        origins += ['http://localhost:5000', 'http://127.0.0.1:5000']
        return origins

    # ─── Rate limiting ────────────────────────────────────────────────────
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_DEFAULTS = ['300 per hour', '60 per minute']

    # ─── OAuth ────────────────────────────────────────────────────────────
    GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
    GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET')

    # ─── Admin ────────────────────────────────────────────────────────────
    @staticmethod
    def admin_identifiers() -> set[str]:
        raw = os.environ.get('ADMIN_USERS', '')
        return {x.strip().lower() for x in raw.split(',') if x.strip()}

    # ─── Storage paths ────────────────────────────────────────────────────
    _base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    DOWNLOADS_DIR = os.environ.get('DOWNLOADS_DIR', os.path.join(_base, 'downloads'))
    COOKIES_DIR = os.environ.get('COOKIES_DIR', os.path.join(_base, 'cookies'))
    FRONTEND_DIST = os.environ.get(
        'FRONTEND_DIST',
        os.path.abspath(os.path.join(_base, '..', 'frontend', 'dist')),
    )
