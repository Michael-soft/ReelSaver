import os
import subprocess

from flask import Blueprint, jsonify, send_from_directory

from app.auth import require_login, require_admin
from app.config import Config
from app.extensions import limiter
from app.services.security import sanitize_filename
from app.services.ytdlp_service import get_version, update_ytdlp

system_bp = Blueprint('system', __name__)


@system_bp.route('/files/<path:filename>', methods=['GET'])
@require_login
def serve_file(filename):
    safe_name = sanitize_filename(filename)
    if not safe_name or safe_name != os.path.basename(safe_name):
        return jsonify({'error': 'Invalid filename'}), 400
    full_path = os.path.join(Config.DOWNLOADS_DIR, safe_name)
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(
        os.path.abspath(Config.DOWNLOADS_DIR), safe_name, as_attachment=True,
    )


@system_bp.route('/ytdlp-version', methods=['GET'])
@require_login
def ytdlp_version():
    return jsonify({'version': get_version()})


@system_bp.route('/update-ytdlp', methods=['POST'])
@require_admin
@limiter.limit('10 per day')
def do_update_ytdlp():
    try:
        return jsonify(update_ytdlp())
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Update timed out (>2 min)'}), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@system_bp.route('/disk-usage', methods=['GET'])
@require_login
def disk_usage():
    total_size = 0
    file_count = 0
    try:
        for fn in os.listdir(Config.DOWNLOADS_DIR):
            fp = os.path.join(Config.DOWNLOADS_DIR, fn)
            if os.path.isfile(fp):
                total_size += os.path.getsize(fp)
                file_count += 1
    except Exception:
        pass
    return jsonify({'totalSize': total_size, 'fileCount': file_count})
