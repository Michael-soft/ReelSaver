import json
import os
import re
import subprocess
import threading
import uuid

from flask import jsonify, request, Response, send_from_directory, session
from flask_login import current_user

from app import app, db, DOWNLOADS_DIR
from models import Download, Setting, Template
from replit_auth import make_replit_blueprint, require_login

app.register_blueprint(make_replit_blueprint(), url_prefix="/auth")

download_progress = {}
download_lock = threading.Lock()


@app.before_request
def make_session_permanent():
    session.permanent = True


@app.route('/api/me', methods=['GET'])
def get_me():
    if current_user.is_authenticated:
        return jsonify({
            'id': current_user.id,
            'email': current_user.email,
            'first_name': current_user.first_name,
            'last_name': current_user.last_name,
            'profile_image_url': current_user.profile_image_url,
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
    args = ['yt-dlp']
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


def run_download(task_id, url, options):
    with app.app_context():
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

            args = build_yt_dlp_args(options.get('settings', {}))

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
                    'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                    '4k': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160]',
                    '1440p': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440]',
                    '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]',
                    '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]',
                    '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]',
                    '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360]',
                }
                fmt = quality_map.get(quality, 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best')
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

            process = subprocess.Popen(
                args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1
            )

            filename = ''
            for line in process.stdout:
                line = line.strip()
                if not line:
                    continue

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

            dl = db.session.get(Download, task_id)
            if process.returncode == 0:
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
            else:
                if dl:
                    dl.status = 'failed'
                    dl.error = 'Download failed'
                    db.session.commit()
                with download_lock:
                    download_progress[task_id]['status'] = 'failed'
        except Exception as e:
            dl = db.session.get(Download, task_id)
            if dl:
                dl.status = 'failed'
                dl.error = str(e)
                db.session.commit()
            with download_lock:
                if task_id in download_progress:
                    download_progress[task_id]['status'] = 'failed'


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
                    yield f"data: {json.dumps({'status': dl.status, 'percent': 100 if dl.status == 'completed' else 0})}\n\n"
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
