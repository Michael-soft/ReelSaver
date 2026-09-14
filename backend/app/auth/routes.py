import re
import uuid

from flask import Blueprint, jsonify, redirect, request
from flask_login import login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db, limiter
from app.models import User

auth_bp = Blueprint('auth', __name__)

USERNAME_RE = re.compile(r'^[A-Za-z0-9_.-]{3,32}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _serialize_user(u: User) -> dict:
    return {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'profile_image_url': u.profile_image_url,
        'auth_provider': u.auth_provider,
    }


@auth_bp.route('/register', methods=['POST'])
@limiter.limit('5 per minute; 20 per hour')
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
@limiter.limit('10 per minute; 50 per hour')
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
