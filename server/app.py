import os
import logging
from flask import Flask, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

logging.basicConfig(level=logging.INFO)


class Base(DeclarativeBase):
    pass


FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'web', 'dist'))

app = Flask(
    __name__,
    static_folder=FRONTEND_DIST,
    static_url_path='',
)
app.secret_key = os.environ.get("SESSION_SECRET", os.urandom(32))
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 60 * 60 * 24 * 30  # 30 days
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

_db_url = os.environ.get("SUPABASE_DATABASE_URL") or os.environ.get("DATABASE_URL")
if _db_url and _db_url.startswith("postgres://"):
    _db_url = "postgresql://" + _db_url[len("postgres://"):]
app.config["SQLALCHEMY_DATABASE_URI"] = _db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 5,
    'max_overflow': 5,
    'connect_args': {
        'sslmode': 'require',
        'connect_timeout': 10,
    },
}
logging.info("DB host: %s", (_db_url.split('@', 1)[1].split('/', 1)[0] if _db_url and '@' in _db_url else 'unknown'))

db = SQLAlchemy(app, model_class=Base)

CORS(app, supports_credentials=True, origins=['*'])

DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), '..', 'downloads')
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# ─── Rate limiter ────────────────────────────────────────────────────────────
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["300 per hour", "60 per minute"],
    storage_uri="memory://",
    headers_enabled=True,
)

# ─── Security headers ────────────────────────────────────────────────────────
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response


with app.app_context():
    import models  # noqa: F401
    db.create_all()
    logging.info("Database tables created")
