from flask import Blueprint, jsonify
from flask_login import current_user

from app.auth import is_admin

account_bp = Blueprint('account', __name__)


@account_bp.route('/me', methods=['GET'])
def get_me():
    if current_user.is_authenticated:
        return jsonify(current_user.serialize(is_admin=is_admin(current_user)))
    return jsonify(None)
