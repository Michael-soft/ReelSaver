import json
import threading
import time
import uuid

from flask import Blueprint, current_app, jsonify, request, Response
from flask_login import current_user

from app.auth import require_login
from app.extensions import db, limiter
from app.models import Download
from app.services.download_manager import (
    download_lock, download_processes, download_progress,
    kill_process, run_download,
)
from app.services.security import validate_url
from app.services.settings_service import get_setting
from app.services.ytdlp_service import fetch_info, fetch_playlist

downloads_bp = Blueprint('downloads', __name__)

MAX_TITLE_LENGTH = 500


@downloads_bp.route('/info', methods=['GET'])
@require_login
@limiter.limit('30 per minute')
def get_info():
    url = request.args.get('url', '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400
    try:
        return jsonify(fetch_info(current_user.id, url))
    except TimeoutError:
        return jsonify({'error': 'Request timed out'}), 408
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@downloads_bp.route('/playlist', methods=['GET'])
@require_login
@limiter.limit('20 per minute')
def get_playlist():
    url = request.args.get('url', '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400
    try:
        return jsonify(fetch_playlist(current_user.id, url))
    except TimeoutError:
        return jsonify({'error': 'Request timed out'}), 408
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@downloads_bp.route('/download', methods=['POST'])
@require_login
@limiter.limit('10 per minute')
def start_download():
    data = request.json or {}
    url = (data.get('url') or '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400

    title = (data.get('title') or url)[:MAX_TITLE_LENGTH]
    thumbnail = (data.get('thumbnail') or '')[:500]
    uploader = (data.get('uploader') or '')[:200]
    duration = data.get('duration')
    if duration is not None:
        try:
            duration = int(duration)
        except (ValueError, TypeError):
            duration = None
    media_type = data.get('mediaType', 'video')
    if media_type not in ('video', 'audio'):
        media_type = 'video'

    try:
        max_concurrent = int(get_setting(current_user.id, 'concurrentDownloads', '3') or '3')
    except (ValueError, TypeError):
        max_concurrent = 3
    with download_lock:
        active_count = len(download_processes)
    if active_count >= max_concurrent:
        return jsonify({
            'error': f'Download queue full — you have {active_count} active download(s). '
                     f'Wait for one to finish or increase the limit in Settings → Network.'
        }), 429

    task_id = str(uuid.uuid4())
    dl = Download(
        id=task_id, user_id=current_user.id, url=url, title=title,
        thumbnail=thumbnail, uploader=uploader, duration=duration,
        media_type=media_type, status='downloading',
    )
    db.session.add(dl)
    db.session.commit()

    app_obj = current_app._get_current_object()
    threading.Thread(
        target=run_download,
        args=(app_obj, task_id, url, data, current_user.id),
        daemon=True,
    ).start()

    return jsonify({'taskId': task_id, 'status': 'started'})


@downloads_bp.route('/download/<task_id>/cancel', methods=['POST'])
@require_login
def cancel_download(task_id):
    dl = db.session.get(Download, task_id)
    if dl and dl.user_id and dl.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403

    with download_lock:
        proc = download_processes.get(task_id)
    if proc is not None:
        kill_process(proc)
    if dl and dl.status == 'downloading':
        dl.status = 'failed'
        dl.error = 'Cancelled by user'
        db.session.commit()
    with download_lock:
        if task_id in download_progress:
            download_progress[task_id]['status'] = 'failed'
            download_progress[task_id]['error'] = 'Cancelled by user'
        download_processes.pop(task_id, None)
    return jsonify({'success': True})


@downloads_bp.route('/downloads/cleanup', methods=['POST'])
@require_login
def cleanup_stuck_downloads():
    rows = db.session.query(Download).filter(Download.status == 'downloading').all()
    n = 0
    for dl in rows:
        with download_lock:
            still_running = dl.id in download_processes
        if not still_running:
            dl.status = 'failed'
            dl.error = 'Interrupted (server restarted or download stalled)'
            n += 1
    if n:
        db.session.commit()
    return jsonify({'cleaned': n})


@downloads_bp.route('/progress/<task_id>', methods=['GET'])
@require_login
def get_progress(task_id):
    app_obj = current_app._get_current_object()

    def event_stream():
        while True:
            with download_lock:
                prog = download_progress.get(task_id)
            if prog:
                yield f"data: {json.dumps(prog)}\n\n"
                if prog.get('status') in ('completed', 'failed', 'cancelled'):
                    break
            else:
                with app_obj.app_context():
                    dl = db.session.get(Download, task_id)
                if dl:
                    yield f"data: {json.dumps({'status': dl.status, 'percent': 100 if dl.status == 'completed' else 0, 'error': dl.error or '', 'filename': dl.filename or ''})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            time.sleep(0.5)

    return Response(event_stream(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
