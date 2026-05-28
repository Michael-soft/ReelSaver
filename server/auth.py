import os
import re
import uuid
from functools import wraps

from flask import Blueprint, jsonify, redirect, request, session, url_for
from flask_dance.consumer import oauth_authorized, oauth_error
from flask_dance.contrib.google import make_google_blueprint, google
from flask_login import LoginManager, current_user, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from app import app, db, limiter
from models import User

login_manager = LoginManager(app)
login_manager.login_view = None


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, user_id)


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Unauthorized'}), 401


def require_login(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


USERNAME_RE = re.compile(r'^[A-Za-z0-9_.-]{3,32}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _serialize_user(u):
    return {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'profile_image_url': u.profile_image_url,
        'auth_provider': u.auth_provider,
    }


auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower() or None
    password = data.get('password') or ''

    if not USERNAME_RE.match(username):
        return jsonify({'error': 'Username must be 3–32 characters: letters, numbers, . _ - only'}), 400
    if email and not EMAIL_RE.match(email):
        return jsonify({'error': 'Invalid email address'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if len(password) > 128:
        return jsonify({'error': 'Password too long (max 128 characters)'}), 400

    if db.session.query(User).filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if email and db.session.query(User).filter_by(email=email).first():
        return jsonify({'error': 'Email already in use'}), 409

    u = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        auth_provider='local',
    )
    db.session.add(u)
    db.session.commit()
    login_user(u, remember=True)
    return jsonify(_serialize_user(u))


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute; 50 per hour")
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('username') or data.get('email') or '').strip()
    password = data.get('password') or ''
    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400
    if len(identifier) > 255 or len(password) > 128:
        return jsonify({'error': 'Invalid credentials'}), 401

    q = db.session.query(User)
    if '@' in identifier:
        u = q.filter_by(email=identifier.lower()).first()
    else:
        u = q.filter_by(username=identifier).first()

    if not u or not u.password_hash or not check_password_hash(u.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    login_user(u, remember=True)
    return jsonify(_serialize_user(u))


@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    logout_user()
    if request.method == 'POST' or request.headers.get('Accept', '').startswith('application/json'):
        return jsonify({'ok': True})
    return redirect('/')


def _build_external_url(path):
    domain = os.environ.get('REPLIT_DEV_DOMAIN', '')
    if domain:
        return f"https://{domain}{path}"
    return url_for('google.authorized', _external=True) if path.endswith('/authorized') else None


google_bp = make_google_blueprint(
    client_id=os.environ.get('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET'),
    scope=[
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],
    offline=False,
    reprompt_consent=False,
)


@google_bp.before_app_request
def _google_session_init():
    if '_session_id' not in session:
        session['_session_id'] = uuid.uuid4().hex
        session.permanent = True


@oauth_authorized.connect_via(google_bp)
def google_logged_in(blueprint, token):
    if not token:
        return redirect('/?auth_error=google_no_token')

    resp = blueprint.session.get('/oauth2/v2/userinfo')
    if not resp.ok:
        return redirect('/?auth_error=google_userinfo')

    info = resp.json()
    google_id = info.get('id')
    email = (info.get('email') or '').lower() or None
    if not google_id:
        return redirect('/?auth_error=google_no_id')

    u = db.session.query(User).filter_by(google_id=google_id).first()
    if not u and email:
        u = db.session.query(User).filter_by(email=email).first()

    if u:
        u.google_id = google_id
        if email and not u.email:
            u.email = email
        if not u.first_name:
            u.first_name = info.get('given_name')
        if not u.last_name:
            u.last_name = info.get('family_name')
        if not u.profile_image_url:
            u.profile_image_url = info.get('picture')
        if u.auth_provider == 'local' and not u.password_hash:
            u.auth_provider = 'google'
    else:
        base_username = (info.get('email') or 'user').split('@')[0]
        base_username = re.sub(r'[^A-Za-z0-9_.-]', '', base_username)[:24] or 'user'
        username = base_username
        n = 1
        while db.session.query(User).filter_by(username=username).first():
            n += 1
            username = f"{base_username}{n}"
        u = User(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            google_id=google_id,
            first_name=info.get('given_name'),
            last_name=info.get('family_name'),
            profile_image_url=info.get('picture'),
            auth_provider='google',
        )
        db.session.add(u)

    db.session.commit()
    login_user(u, remember=True)
    return redirect('/app')


@oauth_error.connect_via(google_bp)
def google_error(blueprint, error, error_description=None, error_uri=None):
    return redirect(f"/?auth_error={error or 'google_oauth_error'}")


def register_auth(app):
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(google_bp, url_prefix='/auth')
