import os

from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.auth import require_login
from app.extensions import db, limiter
from app.models import Setting
from app.services.settings_service import set_setting, user_cookie_path

settings_bp = Blueprint('settings', __name__)

_SETTING_KEYS = [
    'proxy', 'rateLimit', 'concurrentDownloads', 'cookieFile',
    'sponsorBlock', 'embedThumbnail', 'embedMetadata', 'defaultMediaType',
    'defaultQuality', 'defaultAudioFormat',
]
_WRITABLE_KEYS = {
    'proxy', 'rateLimit', 'concurrentDownloads', 'sponsorBlock',
    'embedThumbnail', 'embedMetadata', 'defaultMediaType',
    'defaultQuality', 'defaultAudioFormat',
}
_DEFAULTS = {
    'proxy': '', 'rateLimit': '', 'concurrentDownloads': '3', 'cookieFile': '',
    'sponsorBlock': 'false', 'embedThumbnail': 'true', 'embedMetadata': 'true',
    'defaultMediaType': 'video', 'defaultQuality': 'best', 'defaultAudioFormat': 'mp3',
}


@settings_bp.route('/settings', methods=['GET'])
@require_login
def get_settings():
    rows = db.session.query(Setting).filter(
        Setting.user_id == current_user.id, Setting.key.in_(_SETTING_KEYS)
    ).all()
    result = dict(_DEFAULTS)
    result.update({row.key: row.value for row in rows})
    result['cookieFile'] = 'cookies.txt' if os.path.exists(user_cookie_path(current_user.id)) else ''
    return jsonify(result)


@settings_bp.route('/settings', methods=['POST'])
@require_login
def save_settings():
    data = request.json or {}
    for key, value in data.items():
        if key in _WRITABLE_KEYS:
            set_setting(current_user.id, key, str(value)[:500])
    return jsonify({'success': True})


@settings_bp.route('/cookie-upload', methods=['POST'])
@require_login
@limiter.limit('20 per hour')
def upload_cookie():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'No filename'}), 400
    content = f.read(512 * 1024)  # max 512 KB
    if not content:
        return jsonify({'error': 'File is empty'}), 400
    with open(user_cookie_path(current_user.id), 'wb') as out:
        out.write(content)
    return jsonify({'success': True, 'filename': 'cookies.txt'})
