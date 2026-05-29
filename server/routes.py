import ipaddress
import json
import logging
import os
import re
import signal
import subprocess
import threading
import time
import uuid
from urllib.parse import urlparse

from flask import jsonify, request, Response, send_from_directory, session
from flask_login import current_user

from app import app, db, DOWNLOADS_DIR, limiter
from models import Download, Setting, Template
from auth import register_auth, require_login

register_auth(app)

log = logging.getLogger(__name__)

download_progress = {}
download_lock = threading.Lock()
download_processes = {}  # task_id -> subprocess.Popen

STALL_TIMEOUT = 180
MAX_DOWNLOAD_SECONDS = 30 * 60
MAX_URL_LENGTH = 2048
MAX_TITLE_LENGTH = 500


# ─── URL validation (SSRF protection) ────────────────────────────────────────

_BLOCKED_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal', '169.254.169.254'}


def validate_url(url: str) -> tuple[bool, str]:
    if not url:
        return False, 'URL is required'
    if len(url) > MAX_URL_LENGTH:
        return False, f'URL too long (max {MAX_URL_LENGTH} chars)'
    try:
        parsed = urlparse(url)
    except Exception:
        return False, 'Invalid URL'
    if parsed.scheme not in ('http', 'https'):
        return False, 'URL must start with http:// or https://'
    host = (parsed.hostname or '').lower()
    if not host:
        return False, 'Invalid URL: missing host'
    if host in _BLOCKED_HOSTS:
        return False, 'URL not allowed'
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False, 'URL not allowed'
    except ValueError:
        pass  # domain name — fine
    return True, ''


def _sanitize_filename(name: str) -> str:
    """Return just the basename, no path separators."""
    return os.path.basename(name.replace('\\', '/'))


# ─── Session ─────────────────────────────────────────────────────────────────

@app.before_request
def make_session_permanent():
    session.permanent = True


# ─── /api/me ─────────────────────────────────────────────────────────────────

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


# ─── Settings helpers ─────────────────────────────────────────────────────────

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


# ─── yt-dlp arg builder ───────────────────────────────────────────────────────

_RATE_RE = re.compile(r'^\d+(\.\d+)?[KMGkmg]?$')


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

    proxy = settings.get('proxy', get_setting('proxy', '')).strip()
    if proxy:
        parsed = urlparse(proxy)
        if parsed.scheme in ('http', 'https', 'socks4', 'socks5', 'socks4a', 'socks5h'):
            args += ['--proxy', proxy]

    rate_limit = settings.get('rateLimit', get_setting('rateLimit', '')).strip()
    if rate_limit and _RATE_RE.match(rate_limit):
        args += ['--limit-rate', rate_limit]

    cookie_file = settings.get('cookieFile', get_setting('cookieFile', '')).strip()
    if cookie_file:
        safe_cookie = _sanitize_filename(cookie_file)
        full_path = os.path.join(DOWNLOADS_DIR, safe_cookie)
        if os.path.exists(full_path):
            args += ['--cookies', full_path]

    return args


# ─── /api/info ────────────────────────────────────────────────────────────────

@app.route('/api/info', methods=['GET'])
@require_login
@limiter.limit("30 per minute")
def get_info():
    url = request.args.get('url', '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400
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


# ─── /api/playlist ────────────────────────────────────────────────────────────

@app.route('/api/playlist', methods=['GET'])
@require_login
@limiter.limit("20 per minute")
def get_playlist():
    url = request.args.get('url', '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400
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


# ─── Download engine ──────────────────────────────────────────────────────────

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
        last_lines = []
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
                    download_progress[task_id]['filename'] = fname or ''
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


_ERROR_HINTS = [
    ('Sign in to confirm', 'Sign-in required — upload a cookies.txt file in Settings → Network.'),
    ('Sign in', 'Account sign-in required — upload a cookies.txt file in Settings → Network.'),
    ('login required', 'Login required — upload a cookies.txt file in Settings → Network.'),
    ('This video is private', 'This video is private and cannot be downloaded.'),
    ('age-restricted', 'Age-restricted video — upload a cookies.txt file in Settings → Network.'),
    ('age restricted', 'Age-restricted video — upload a cookies.txt file in Settings → Network.'),
    ('confirm your age', 'Age verification required — upload a cookies.txt file in Settings → Network.'),
    ('members-only', 'Members-only content — upload a cookies.txt file in Settings → Network.'),
    ('This video is not available', 'Video not available in your region or has been removed.'),
    ('Video unavailable', 'Video unavailable — it may have been removed or made private.'),
    ('HTTP Error 403', 'Access denied (HTTP 403) — the content may be region-locked or require login.'),
    ('HTTP Error 404', 'Video not found (HTTP 404) — the URL may be invalid or the video was deleted.'),
    ('Requested format', 'The requested quality/format is not available — try a different quality.'),
    ('not a bot', 'Bot detection triggered — wait a few minutes and try again.'),
    ('Unable to extract', 'Could not extract video info — the URL may be unsupported or the page changed.'),
    ('No video formats found', 'No downloadable formats found for this URL.'),
    ('ffmpeg', 'ffmpeg error during post-processing — the download may still be available as a raw file.'),
]


def _extract_error(lines):
    text = '\n'.join(lines)
    for keyword, hint in _ERROR_HINTS:
        if keyword.lower() in text.lower():
            return hint
    for ln in reversed(lines):
        if 'ERROR:' in ln or 'error:' in ln.lower():
            return ln.split('ERROR:', 1)[-1].strip() or ln
    return lines[-1] if lines else ''


# ─── /api/download ────────────────────────────────────────────────────────────

@app.route('/api/download', methods=['POST'])
@require_login
@limiter.limit("10 per minute")
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

    # Enforce concurrent download limit
    try:
        max_concurrent = int(get_setting('concurrentDownloads', '3') or '3')
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
        id=task_id,
        user_id=current_user.id,
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


# ─── /api/download/<id>/cancel ────────────────────────────────────────────────

@app.route('/api/download/<task_id>/cancel', methods=['POST'])
@require_login
def cancel_download(task_id):
    dl = db.session.get(Download, task_id)
    if dl and dl.user_id and dl.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403

    with download_lock:
        proc = download_processes.get(task_id)
    if proc is not None:
        _kill_process(proc)
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


# ─── /api/downloads/cleanup ───────────────────────────────────────────────────

@app.route('/api/downloads/cleanup', methods=['POST'])
@require_login
def cleanup_stuck_downloads():
    query = db.session.query(Download).filter(Download.status == 'downloading')
    rows = query.all()
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


# ─── /api/progress/<task_id> ──────────────────────────────────────────────────

@app.route('/api/progress/<task_id>', methods=['GET'])
@require_login
def get_progress(task_id):
    def event_stream():
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
                    yield f"data: {json.dumps({'status': dl.status, 'percent': 100 if dl.status == 'completed' else 0, 'error': dl.error or '', 'filename': dl.filename or ''})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            time.sleep(0.5)

    return Response(event_stream(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


# ─── /api/history ─────────────────────────────────────────────────────────────

@app.route('/api/history', methods=['GET'])
@require_login
def get_history():
    search = request.args.get('search', '')
    media_type = request.args.get('type', '')
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('perPage', 20))))

    query = db.session.query(Download).filter(
        (Download.user_id == current_user.id) | (Download.user_id == None)  # noqa: E711
    )
    if search:
        like = f'%{search}%'
        query = query.filter(
            (Download.title.ilike(like)) |
            (Download.url.ilike(like)) |
            (Download.uploader.ilike(like))
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
    if dl and dl.user_id and dl.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
    if dl:
        if dl.filename:
            safe = _sanitize_filename(dl.filename)
            filepath = os.path.join(DOWNLOADS_DIR, safe)
            if os.path.exists(filepath):
                os.remove(filepath)
        db.session.delete(dl)
        db.session.commit()
    return jsonify({'success': True})


@app.route('/api/history', methods=['DELETE'])
@require_login
def clear_history():
    ids = request.json.get('ids', []) if request.json else []
    base_query = db.session.query(Download).filter(
        (Download.user_id == current_user.id) | (Download.user_id == None)  # noqa: E711
    )
    if ids:
        safe_ids = [str(i) for i in ids if isinstance(i, str)]
        rows = base_query.filter(Download.id.in_(safe_ids)).all()
    else:
        rows = base_query.all()
    for dl in rows:
        if dl.filename:
            safe = _sanitize_filename(dl.filename)
            fp = os.path.join(DOWNLOADS_DIR, safe)
            if os.path.exists(fp):
                os.remove(fp)
        db.session.delete(dl)
    db.session.commit()
    return jsonify({'success': True})


# ─── /api/stats ───────────────────────────────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
@require_login
def get_stats():
    from sqlalchemy import func
    base = db.session.query(Download).filter(
        (Download.user_id == current_user.id) | (Download.user_id == None)  # noqa: E711
    )
    total = base.count()
    completed = base.filter(Download.status == 'completed').count()
    failed = base.filter(Download.status == 'failed').count()
    downloading = base.filter(Download.status == 'downloading').count()
    audio_count = base.filter(Download.media_type == 'audio').count()
    video_count = base.filter(Download.media_type == 'video').count()
    total_size = db.session.query(func.sum(Download.filesize)).filter(
        Download.status == 'completed',
        (Download.user_id == current_user.id) | (Download.user_id == None)  # noqa: E711
    ).scalar() or 0
    recent = base.order_by(Download.created_at.desc()).limit(5).all()

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


# ─── /api/settings ────────────────────────────────────────────────────────────

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
    allowed_keys = {'proxy', 'rateLimit', 'concurrentDownloads', 'cookieFile',
                    'sponsorBlock', 'embedThumbnail', 'embedMetadata',
                    'defaultMediaType', 'defaultQuality', 'defaultAudioFormat'}
    for key, value in data.items():
        if key in allowed_keys:
            set_setting(key, str(value)[:500])
    return jsonify({'success': True})


# ─── /api/templates ───────────────────────────────────────────────────────────

@app.route('/api/templates', methods=['GET'])
@require_login
def get_templates():
    rows = db.session.query(Template).order_by(Template.created_at.desc()).all()
    return jsonify([{'id': r.id, 'name': r.name, 'command': r.command,
                     'created_at': r.created_at.isoformat() if r.created_at else None} for r in rows])


@app.route('/api/templates', methods=['POST'])
@require_login
@limiter.limit("20 per hour")
def create_template():
    data = request.json or {}
    name = (data.get('name') or '').strip()[:100]
    command = (data.get('command') or '').strip()[:1000]
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


# ─── /api/command ─────────────────────────────────────────────────────────────

@app.route('/api/command', methods=['POST'])
@require_login
@limiter.limit("5 per minute")
def run_command():
    data = request.json or {}
    url = (data.get('url') or '').strip()
    ok, err = validate_url(url)
    if not ok:
        return jsonify({'error': err}), 400

    command = (data.get('command') or '').strip()[:1000]
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


# ─── /api/files/<filename> ────────────────────────────────────────────────────

@app.route('/api/files/<path:filename>', methods=['GET'])
@require_login
def serve_file(filename):
    safe_name = _sanitize_filename(filename)
    if not safe_name or safe_name != os.path.basename(safe_name):
        return jsonify({'error': 'Invalid filename'}), 400
    full_path = os.path.join(DOWNLOADS_DIR, safe_name)
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(
        os.path.abspath(DOWNLOADS_DIR),
        safe_name,
        as_attachment=True,
    )


# ─── /api/cookie-upload ───────────────────────────────────────────────────────

@app.route('/api/cookie-upload', methods=['POST'])
@require_login
@limiter.limit("20 per hour")
def upload_cookie():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'No filename'}), 400
    content = f.read(512 * 1024)  # max 512 KB
    if not content:
        return jsonify({'error': 'File is empty'}), 400
    # Basic Netscape cookie format check
    if not content.lstrip().startswith(b'# Netscape') and b'\t' not in content[:2048]:
        log.warning('Uploaded cookie file does not look like Netscape format')
    filepath = os.path.join(DOWNLOADS_DIR, 'cookies.txt')
    with open(filepath, 'wb') as out:
        out.write(content)
    set_setting('cookieFile', 'cookies.txt')
    return jsonify({'success': True, 'filename': 'cookies.txt'})


# ─── /api/ytdlp-version ───────────────────────────────────────────────────────

@app.route('/api/ytdlp-version', methods=['GET'])
@require_login
def get_ytdlp_version():
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=10)
        return jsonify({'version': result.stdout.strip() if result.returncode == 0 else 'unknown'})
    except Exception:
        return jsonify({'version': 'unknown'})


# ─── /api/update-ytdlp ────────────────────────────────────────────────────────

@app.route('/api/update-ytdlp', methods=['POST'])
@require_login
@limiter.limit("10 per day")
def update_ytdlp():
    try:
        result = subprocess.run(
            ['pip', 'install', '--upgrade', 'yt-dlp'],
            capture_output=True, text=True, timeout=120
        )
        ver = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=10)
        version = ver.stdout.strip() if ver.returncode == 0 else 'unknown'
        return jsonify({
            'success': result.returncode == 0,
            'version': version,
            'output': (result.stdout + result.stderr)[-1500:],
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Update timed out (>2 min)'}), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── /api/disk-usage ──────────────────────────────────────────────────────────

@app.route('/api/disk-usage', methods=['GET'])
@require_login
def get_disk_usage():
    total_size = 0
    file_count = 0
    try:
        for fn in os.listdir(DOWNLOADS_DIR):
            fp = os.path.join(DOWNLOADS_DIR, fn)
            if os.path.isfile(fp):
                total_size += os.path.getsize(fp)
                file_count += 1
    except Exception:
        pass
    return jsonify({'totalSize': total_size, 'fileCount': file_count})


# ─── SPA fallback ─────────────────────────────────────────────────────────────

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


@app.errorhandler(429)
def rate_limit_error(e):
    return jsonify({'error': 'Too many requests — please wait a moment before trying again.'}), 429
