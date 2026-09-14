import subprocess

from flask import Blueprint, jsonify, request

from app.auth import require_admin
from app.config import Config
from app.extensions import limiter
from app.services.security import validate_url
from app.services.ytdlp_service import build_safe_command

command_bp = Blueprint('command', __name__)


@command_bp.route('/command', methods=['POST'])
@require_admin
@limiter.limit('5 per minute')
def run_command():
    data = request.json or {}
    url = (data.get('url') or '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400

    command = (data.get('command') or '').strip()[:1000]
    safe_args = build_safe_command(command, Config.DOWNLOADS_DIR, url)

    try:
        result = subprocess.run(safe_args, capture_output=True, text=True, timeout=300)
        return jsonify({
            'stdout': result.stdout[-3000:] if result.stdout else '',
            'stderr': result.stderr[-2000:] if result.stderr else '',
            'returncode': result.returncode,
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Command timed out'}), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500
