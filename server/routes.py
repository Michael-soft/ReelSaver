import json
import logging
import os
import re
import signal
import subprocess
import threading
import time
import uuid

from flask import jsonify, request, Response, send_from_directory, session
from flask_login import current_user

from app import app, db, DOWNLOADS_DIR
from models import Download, Setting, Template
from auth import register_auth, require_login

register_auth(app)

log = logging.getLogger(__name__)

download_progress = {}
download_lock = threading.Lock()
download_processes = {}  # task_id -> subprocess.Popen

# Kill the download if no output is received for this many seconds.
STALL_TIMEOUT = 180
# Hard cap on how long any single download can run.
MAX_DOWNLOAD_SECONDS = 30 * 60


@app.before_request
def make_session_permanent():
    session.permanent = True



@app.route('/api/me', methods=['GET'])
def get_me():
    if current_user.is_authenticated:
        return jsonify({
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'profile_image_url': current_user.profile_image_url,
            'auth_provider': current_user.auth_provider,
        })
    return jsonify(None)


def get_setting(key, default=None):
    row = db.session.get(Setting, key)
    return row.value if row else default


def set_setting(key, value):
    row = db.session.get(Setting, key)
    if row:
        row.value = str(value)
    else:
        row = Setting(key=key, value=str(value))
        db.session.add(row)
    db.session.commit()


def build_yt_dlp_args(settings=None):
    args = [
        'yt-dlp',
        '--socket-timeout', '30',
        '--retries', '3',
        '--fragment-retries', '3',
        '--no-warnings',
    ]
    if not settings:
        settings = {}
    proxy = settings.get('proxy', get_setting('proxy', ''))
    if proxy:
        args += ['--proxy', proxy]
    rate_limit = settings.get('rateLimit', get_setting('rateLimit', ''))
    if rate_limit:
        args += ['--limit-rate', rate_limit]
    cookie_file = settings.get('cookieFile', get_setting('cookieFile', ''))
    if cookie_file and os.path.exists(cookie_file):
        args += ['--cookies', cookie_file]
    return args


@app.route('/api/info', methods=['GET'])
@require_login
def get_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    try:
        args = build_yt_dlp_args() + [
            '--dump-json', '--no-playlist',
            '--skip-download', '--', url
        ]
        result = subprocess.run(args, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            err = result.stderr.strip() or 'Failed to fetch info'
            return jsonify({'error': err}), 400
        data = json.loads(result.stdout.strip())
        info = {
            'id': data.get('id'),
            'title': data.get('title'),
            'thumbnail': data.get('thumbnail'),
            'uploader': data.get('uploader') or data.get('channel'),
            'duration': data.get('duration'),
            'description': (data.get('description') or '')[:500],
            'webpage_url': data.get('webpage_url') or url,
            'extractor': data.get('extractor_key') or data.get('extractor'),
            'view_count': data.get('view_count'),
            'upload_date': data.get('upload_date'),
            'is_playlist': False,
            'formats': [],
        }
        formats = []
        for f in data.get('formats', []):
            fmt = {
                'format_id': f.get('format_id'),
                'ext': f.get('ext'),
                'resolution': f.get('resolution') or f.get('format_note'),
                'filesize': f.get('filesize') or f.get('filesize_approx'),
                'vcodec': f.get('vcodec'),
                'acodec': f.get('acodec'),
                'fps': f.get('fps'),
                'tbr': f.get('tbr'),
                'abr': f.get('abr'),
                'format_note': f.get('format_note'),
            }
            formats.append(fmt)
        info['formats'] = formats
        return jsonify(info)
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/playlist', methods=['GET'])
@require_login
def get_playlist():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    try:
        args = build_yt_dlp_args() + [
            '--flat-playlist', '--dump-json',
            '--yes-playlist', '--', url
        ]
        result = subprocess.run(args, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            err = result.stderr.strip() or 'Failed to fetch playlist'
            return jsonify({'error': err}), 400
        items = []
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                items.append({
                    'id': entry.get('id'),
                    'title': entry.get('title'),
                    'url': entry.get('url') or entry.get('webpage_url'),
                    'thumbnail': entry.get('thumbnail'),
                    'duration': entry.get('duration'),
                    'uploader': entry.get('uploader') or entry.get('channel'),
                })
            except Exception:
                pass
        return jsonify({'items': items, 'count': len(items)})
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timed out'}), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _kill_process(proc):
    try:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass


def run_download(task_id, url, options):
    with app.app_context():
        process = None
        last_lines = []  # rolling buffer of recent output for error reporting
        try:
            media_type = options.get('mediaType', 'video')
            quality = options.get('quality', 'best')
            audio_format = options.get('audioFormat', 'mp3')
            video_format = options.get('videoFormat', 'mp4')
            format_id = options.get('formatId', '')
            embed_thumbnail = options.get('embedThumbnail', False)
            embed_subtitle = options.get('embedSubtitle', False)
            embed_metadata = options.get('embedMetadata', True)
            sponsor_block = options.get('sponsorBlock', False)
            no_watermark = options.get('noWatermark', False)

            args = build_yt_dlp_args(options.get('settings', {}))

            if no_watermark:
                args += [
                    '--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com',
                    '--format-sort', 'hasaud,res,br',
                ]

            output_template = os.path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s')
            args += ['--output', output_template, '--no-playlist', '--progress', '--newline']

            if format_id:
                args += ['--format', format_id]
            elif media_type == 'audio':
                args += ['--extract-audio', '--audio-format', audio_format]
                quality_map = {'best': '0', '320k': '0', '256k': '5', '192k': '5', '128k': '7'}
                q = quality_map.get(quality, '5')
                args += ['--audio-quality', q]
            else:
                quality_map = {
                    'best': 'bestvideo*[ext=mp4]+bestaudio[ext=m4a]/bestvideo*+bestaudio/best',
                    '4k': 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
                    '1440p': 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
                    '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                    '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
                    '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
                    '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]',
                }
                fmt = quality_map.get(quality, 'bestvideo*+bestaudio/best')
                if video_format == 'mkv':
                    args += ['--remux-video', 'mkv']
                args += ['--format', fmt]

            if embed_thumbnail:
                args += ['--embed-thumbnail']
            if embed_subtitle:
                args += ['--embed-subs', '--write-subs', '--sub-langs', 'en']
            if embed_metadata:
                args += ['--embed-metadata']
            if sponsor_block:
                args += ['--sponsorblock-remove', 'sponsor']

            args += ['--', url]

            with download_lock:
                download_progress[task_id] = {
                    'status': 'downloading',
                    'percent': 0,
                    'speed': '',
                    'eta': '',
                    'filename': '',
                }

            log.info('Starting download %s url=%s', task_id, url)
            process = subprocess.Popen(
                args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1,
                start_new_session=True,
            )
            with download_lock:
                download_processes[task_id] = process

            # Watchdog: kill if no output for STALL_TIMEOUT seconds, or
            # if total runtime exceeds MAX_DOWNLOAD_SECONDS.
            started_at = time.time()
            last_output_at = [time.time()]
            stall_reason = ['']
            stop_watchdog = threading.Event()

            def watchdog():
                while not stop_watchdog.wait(5):
                    now = time.time()
                    if now - last_output_at[0] > STALL_TIMEOUT:
                        stall_reason[0] = (
                            f'No progress for {STALL_TIMEOUT}s — the source likely '
                            f'requires login or is blocked. Try uploading a cookies '
                            f'file in Settings.'
                        )
                        _kill_process(process)
                        return
                    if now - started_at > MAX_DOWNLOAD_SECONDS:
                        stall_reason[0] = (
                            f'Download exceeded the {MAX_DOWNLOAD_SECONDS // 60}-minute limit.'
                        )
                        _kill_process(process)
                        return

            wd_thread = threading.Thread(target=watchdog, daemon=True)
            wd_thread.start()

            filename = ''
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue
                last_output_at[0] = time.time()
                last_lines.append(line)
                if len(last_lines) > 30:
                    last_lines.pop(0)

                percent_match = re.search(r'\[download\]\s+([\d.]+)%', line)
                speed_match = re.search(r'at\s+([\d.]+\s*\w+/s)', line)
                eta_match = re.search(r'ETA\s+([\d:]+)', line)
                dest_match = re.search(r'\[download\] Destination:\s+(.+)', line)
                merge_match = re.search(r'Merging formats into "(.+)"', line)

                with download_lock:
                    prog = download_progress.get(task_id, {})
                    if percent_match:
                        prog['percent'] = float(percent_match.group(1))
                    if speed_match:
                        prog['speed'] = speed_match.group(1)
                    if eta_match:
                        prog['eta'] = eta_match.group(1)
                    if dest_match:
                        fn = dest_match.group(1).strip()
                        prog['filename'] = fn
                        filename = fn
                    if merge_match:
                        fn = merge_match.group(1).strip()
                        prog['filename'] = fn
                        filename = fn
                    download_progress[task_id] = prog

            process.wait()
            stop_watchdog.set()

            with download_lock:
                download_processes.pop(task_id, None)

            dl = db.session.get(Download, task_id)
            if process.returncode == 0 and not stall_reason[0]:
                fsize = os.path.getsize(filename) if filename and os.path.exists(filename) else None
                fname = os.path.basename(filename) if filename else None
                ext = fname.rsplit('.', 1)[-1] if fname and '.' in fname else ''
                if dl:
                    dl.status = 'completed'
                    dl.filename = fname
                    dl.filesize = fsize
                    dl.ext = ext
                    db.session.commit()
                with download_lock:
                    download_progress[task_id]['status'] = 'completed'
                    download_progress[task_id]['percent'] = 100
                log.info('Download %s completed: %s', task_id, fname)
            else:
                err = stall_reason[0] or _extract_error(last_lines) or 'Download failed'
                if dl:
                    dl.status = 'failed'
                    dl.error = err[:500]
                    db.session.commit()
                with download_lock:
                    download_progress[task_id]['status'] = 'failed'
                    download_progress[task_id]['error'] = err
                log.warning('Download %s failed: %s', task_id, err)
        except Exception as e:
            log.exception('Download %s crashed', task_id)
            err = stall_reason[0] if 'stall_reason' in locals() and stall_reason[0] else str(e)
            dl = db.session.get(Download, task_id)
            if dl:
                dl.status = 'failed'
                dl.error = err[:500]
                db.session.commit()
            with download_lock:
                if task_id in download_progress:
                    download_progress[task_id]['status'] = 'failed'
                    download_progress[task_id]['error'] = err
                download_processes.pop(task_id, None)
        finally:
            if process is not None:
                _kill_process(process)


def _extract_error(lines):
    """Pull the most useful-looking error message out of yt-dlp output."""
    for ln in reversed(lines):
        if 'ERROR:' in ln or 'error:' in ln.lower():
            return ln.split('ERROR:', 1)[-1].strip() or ln
    return lines[-1] if lines else ''


@app.route('/api/download', methods=['POST'])
@require_login
def start_download():
    data = request.json or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    task_id = str(uuid.uuid4())
    title = data.get('title', url)
    thumbnail = data.get('thumbnail', '')
    uploader = data.get('uploader', '')
    duration = data.get('duration')
    media_type = data.get('mediaType', 'video')

    dl = Download(
        id=task_id,
        url=url,
        title=title,
        thumbnail=thumbnail,
        uploader=uploader,
        duration=duration,
        media_type=media_type,
        status='downloading',
    )
    db.session.add(dl)
    db.session.commit()

    thread = threading.Thread(target=run_download, args=(task_id, url, data), daemon=True)
    thread.start()

    return jsonify({'taskId': task_id, 'status': 'started'})


@app.route('/api/download/<task_id>/cancel', methods=['POST'])
@require_login
def cancel_download(task_id):
    """Stop a running download and mark it failed."""
    with download_lock:
        proc = download_processes.get(task_id)
    if proc is not None:
        _kill_process(proc)
    dl = db.session.get(Download, task_id)
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


@app.route('/api/downloads/cleanup', methods=['POST'])
@require_login
def cleanup_stuck_downloads():
    """Mark any download still in 'downloading' state as failed.
    Useful after a server restart when in-memory state is lost."""
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


def _recover_stuck_on_startup():
    """On server boot, mark any leftover 'downloading' rows as failed."""
    try:
        with app.app_context():
            rows = db.session.query(Download).filter(Download.status == 'downloading').all()
            for dl in rows:
                dl.status = 'failed'
                dl.error = 'Interrupted (server restarted)'
            if rows:
                db.session.commit()
                log.info('Recovered %d stuck download(s) on startup', len(rows))
    except Exception:
        log.exception('Stuck-download recovery failed')


_recover_stuck_on_startup()


@app.route('/api/progress/<task_id>', methods=['GET'])
@require_login
def get_progress(task_id):
    def event_stream():
        import time
        while True:
            with download_lock:
                prog = download_progress.get(task_id)
            if prog:
                yield f"data: {json.dumps(prog)}\n\n"
                if prog.get('status') in ('completed', 'failed', 'cancelled'):
                    break
            else:
                with app.app_context():
                    dl = db.session.get(Download, task_id)
                if dl:
                    yield f"data: {json.dumps({'status': dl.status, 'percent': 100 if dl.status == 'completed' else 0, 'error': dl.error or ''})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            time.sleep(0.5)

    return Response(event_stream(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/history', methods=['GET'])
@require_login
def get_history():
    search = request.args.get('search', '')
    media_type = request.args.get('type', '')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('perPage', 20))

    query = db.session.query(Download)
    if search:
        like = f'%{search}%'
        query = query.filter(
            (Download.title.like(like)) |
            (Download.url.like(like)) |
            (Download.uploader.like(like))
        )
    if media_type in ('video', 'audio'):
        query = query.filter(Download.media_type == media_type)

    total = query.count()
    rows = query.order_by(Download.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    items = [{
        'id': r.id,
        'url': r.url,
        'title': r.title,
        'thumbnail': r.thumbnail,
        'uploader': r.uploader,
        'duration': r.duration,
        'media_type': r.media_type,
        'format_id': r.format_id,
        'ext': r.ext,
        'filename': r.filename,
        'filesize': r.filesize,
        'status': r.status,
        'error': r.error,
        'created_at': r.created_at.isoformat() if r.created_at else None,
    } for r in rows]

    return jsonify({'items': items, 'total': total, 'page': page, 'perPage': per_page})


@app.route('/api/history/<task_id>', methods=['DELETE'])
@require_login
def delete_history(task_id):
    dl = db.session.get(Download, task_id)
    if dl and dl.filename:
        filepath = os.path.join(DOWNLOADS_DIR, dl.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    if dl:
        db.session.delete(dl)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/history', methods=['DELETE'])
@require_login
def clear_history():
    ids = request.json.get('ids', []) if request.json else []
    if ids:
        for tid in ids:
            dl = db.session.get(Download, tid)
            if dl:
                if dl.filename:
                    fp = os.path.join(DOWNLOADS_DIR, dl.filename)
                    if os.path.exists(fp):
                        os.remove(fp)
                db.session.delete(dl)
    else:
        rows = db.session.query(Download).all()
        for dl in rows:
            if dl.filename:
                fp = os.path.join(DOWNLOADS_DIR, dl.filename)
                if os.path.exists(fp):
                    os.remove(fp)
            db.session.delete(dl)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/stats', methods=['GET'])
@require_login
def get_stats():
    from sqlalchemy import func
    total = db.session.query(func.count(Download.id)).scalar()
    completed = db.session.query(func.count(Download.id)).filter(Download.status == 'completed').scalar()
    failed = db.session.query(func.count(Download.id)).filter(Download.status == 'failed').scalar()
    downloading = db.session.query(func.count(Download.id)).filter(Download.status == 'downloading').scalar()
    audio_count = db.session.query(func.count(Download.id)).filter(Download.media_type == 'audio').scalar()
    video_count = db.session.query(func.count(Download.id)).filter(Download.media_type == 'video').scalar()
    total_size = db.session.query(func.sum(Download.filesize)).filter(Download.status == 'completed').scalar() or 0
    recent = db.session.query(Download).order_by(Download.created_at.desc()).limit(5).all()

    return jsonify({
        'total': total,
        'completed': completed,
        'failed': failed,
        'downloading': downloading,
        'audioCount': audio_count,
        'videoCount': video_count,
        'totalSize': total_size,
        'recent': [{
            'id': r.id,
            'url': r.url,
            'title': r.title,
            'thumbnail': r.thumbnail,
            'uploader': r.uploader,
            'duration': r.duration,
            'media_type': r.media_type,
            'ext': r.ext,
            'filename': r.filename,
            'filesize': r.filesize,
            'status': r.status,
            'created_at': r.created_at.isoformat() if r.created_at else None,
        } for r in recent],
    })


@app.route('/api/settings', methods=['GET'])
@require_login
def get_settings():
    keys = ['proxy', 'rateLimit', 'concurrentDownloads', 'cookieFile',
            'sponsorBlock', 'embedThumbnail', 'embedMetadata', 'defaultMediaType',
            'defaultQuality', 'defaultAudioFormat']
    rows = db.session.query(Setting).filter(Setting.key.in_(keys)).all()
    settings = {row.key: row.value for row in rows}
    defaults = {
        'proxy': '',
        'rateLimit': '',
        'concurrentDownloads': '3',
        'cookieFile': '',
        'sponsorBlock': 'false',
        'embedThumbnail': 'true',
        'embedMetadata': 'true',
        'defaultMediaType': 'video',
        'defaultQuality': 'best',
        'defaultAudioFormat': 'mp3',
    }
    defaults.update(settings)
    return jsonify(defaults)


@app.route('/api/settings', methods=['POST'])
@require_login
def save_settings():
    data = request.json or {}
    for key, value in data.items():
        set_setting(key, value)
    return jsonify({'success': True})


@app.route('/api/templates', methods=['GET'])
@require_login
def get_templates():
    rows = db.session.query(Template).order_by(Template.created_at.desc()).all()
    return jsonify([{'id': r.id, 'name': r.name, 'command': r.command,
                     'created_at': r.created_at.isoformat() if r.created_at else None} for r in rows])


@app.route('/api/templates', methods=['POST'])
@require_login
def create_template():
    data = request.json or {}
    name = data.get('name', '').strip()
    command = data.get('command', '').strip()
    if not name or not command:
        return jsonify({'error': 'Name and command required'}), 400
    tid = str(uuid.uuid4())
    t = Template(id=tid, name=name, command=command)
    db.session.add(t)
    db.session.commit()
    return jsonify({'id': tid, 'name': name, 'command': command})


@app.route('/api/templates/<tid>', methods=['DELETE'])
@require_login
def delete_template(tid):
    t = db.session.get(Template, tid)
    if t:
        db.session.delete(t)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/command', methods=['POST'])
@require_login
def run_command():
    data = request.json or {}
    url = data.get('url', '').strip()
    command = data.get('command', '').strip()
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    cmd_parts = command.split() if command else []
    safe_args = ['yt-dlp']
    allowed_flags = [
        '--extract-audio', '--audio-format', '--audio-quality', '--format',
        '--output', '--embed-thumbnail', '--embed-metadata', '--embed-subs',
        '--write-subs', '--sub-langs', '--remux-video', '--limit-rate',
        '--sponsorblock-remove', '--proxy', '--no-playlist', '--yes-playlist',
        '--flat-playlist',
    ]
    i = 0
    while i < len(cmd_parts):
        part = cmd_parts[i]
        if part in allowed_flags:
            safe_args.append(part)
            if i + 1 < len(cmd_parts) and not cmd_parts[i + 1].startswith('--'):
                i += 1
                safe_args.append(cmd_parts[i])
        i += 1

    safe_args += ['--output', os.path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s'), url]

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


@app.route('/api/files/<path:filename>', methods=['GET'])
@require_login
def serve_file(filename):
    return send_from_directory(DOWNLOADS_DIR, filename)


@app.route('/')
def serve_index():
    index_path = os.path.join(app.static_folder, 'index.html')
    if not os.path.exists(index_path):
        return jsonify({'error': 'Frontend not built. Run `npm run build` in web/.'}), 503
    return send_from_directory(app.static_folder, 'index.html')


@app.errorhandler(404)
def spa_fallback(_e):
    path = request.path.lstrip('/')
    if path.startswith('api/') or path.startswith('auth/'):
        return jsonify({'error': 'Not found'}), 404
    index_path = os.path.join(app.static_folder, 'index.html')
    if not os.path.exists(index_path):
        return jsonify({'error': 'Frontend not built'}), 503
    return send_from_directory(app.static_folder, 'index.html')
