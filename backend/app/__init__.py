import logging
import os

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import Config
from app.extensions import cors, db, limiter, login_manager, migrate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def _resolve_session_secret() -> bytes | str:
    if Config.SESSION_SECRET:
        return Config.SESSION_SECRET
    if Config.IS_PRODUCTION:
        raise RuntimeError(
            'SESSION_SECRET environment variable is required in production. '
            'Set it to a long random string.'
        )
    log.warning('SESSION_SECRET not set — using an ephemeral key (sessions reset on restart). Dev only.')
    return os.urandom(32)


def create_app() -> Flask:
    os.makedirs(Config.DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(Config.COOKIES_DIR, exist_ok=True)

    app = Flask(__name__, static_folder=Config.FRONTEND_DIST, static_url_path='')
    app.secret_key = _resolve_session_secret()
    app.config.from_object(Config)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    _init_extensions(app)
    _register_blueprints(app)
    _register_hooks(app)
    _register_error_handlers(app)

    with app.app_context():
        from app import models  # noqa: F401
        # In production, manage schema via Alembic (`flask db upgrade`).
        # Set AUTO_CREATE_DB=true to auto-create tables in dev.
        if os.environ.get('AUTO_CREATE_DB', 'true').lower() == 'true' and not Config.IS_PRODUCTION:
            db.create_all()
            log.info('Database tables ensured (dev auto-create)')
        from app.services.download_manager import recover_stuck_on_startup
        recover_stuck_on_startup(app)

    return app


def _init_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = None
    limiter.init_app(app)
    limiter.default_limits = Config.RATELIMIT_DEFAULTS
    cors.init_app(app, supports_credentials=True, origins=Config.cors_origins())
    log.info('CORS allowed origins: %s', Config.cors_origins())

    from app.models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, user_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({'error': 'Unauthorized'}), 401


def _register_blueprints(app: Flask) -> None:
    from app.api import api_bp
    from app.auth.routes import auth_bp
    from app.auth.oauth import google_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(google_bp, url_prefix='/auth')


def _register_hooks(app: Flask) -> None:
    @app.before_request
    def make_session_permanent():
        session.permanent = True

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


def _serve_spa(app: Flask):
    index_path = os.path.join(app.static_folder, 'index.html')
    if not os.path.exists(index_path):
        return jsonify({'error': 'Frontend not built. Run `npm run build` in frontend/.'}), 503
    return send_from_directory(app.static_folder, 'index.html')


def _register_error_handlers(app: Flask) -> None:
    @app.route('/')
    def serve_index():
        return _serve_spa(app)

    @app.errorhandler(404)
    def spa_fallback(_e):
        path = request.path.lstrip('/')
        if path.startswith('api/') or path.startswith('auth/'):
            return jsonify({'error': 'Not found'}), 404
        return _serve_spa(app)

    @app.errorhandler(429)
    def rate_limit_error(_e):
        return jsonify({'error': 'Too many requests — please wait a moment before trying again.'}), 429
