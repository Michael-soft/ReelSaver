from functools import wraps

from flask import jsonify
from flask_login import current_user

from app.config import Config


def is_admin(user) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    admins = Config.admin_identifiers()
    if not admins:
        return False
    candidates = {(user.username or '').lower(), (user.email or '').lower()}
    return bool(candidates & admins)


def require_login(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthorized'}), 401
        if not is_admin(current_user):
            return jsonify({'error': 'Forbidden: admin access required'}), 403
        return f(*args, **kwargs)
    return decorated
