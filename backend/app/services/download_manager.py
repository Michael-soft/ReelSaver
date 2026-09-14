import logging
import os
import re
import subprocess
import threading
import time

from app.config import Config
from app.extensions import db
from app.models import Download
from app.services.ytdlp_service import build_yt_dlp_args

log = logging.getLogger(__name__)

STALL_TIMEOUT = 180
MAX_DOWNLOAD_SECONDS = 30 * 60

# In-memory download state
download_progress: dict[str, dict] = {}
download_lock = threading.Lock()
download_processes: dict[str, subprocess.Popen] = {}


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


def extract_error(lines: list[str]) -> str:
    text = '\n'.join(lines)
    for keyword, hint in _ERROR_HINTS:
        if keyword.lower() in text.lower():
            return hint
    for ln in reversed(lines):
        if 'ERROR:' in ln or 'error:' in ln.lower():
            return ln.split('ERROR:', 1)[-1].strip() or ln
    return lines[-1] if lines else ''


def kill_process(proc: subprocess.Popen) -> None:
    try:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        pass


def _build_download_args(user_id: str, url: str, options: dict) -> list[str]:
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

    args = build_yt_dlp_args(user_id, options.get('settings', {}))

    if no_watermark:
        args += [
            '--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com',
            '--format-sort', 'hasaud,res,br',
        ]

    output_template = os.path.join(Config.DOWNLOADS_DIR, '%(title)s.%(ext)s')
    args += ['--output', output_template, '--no-playlist', '--progress', '--newline']

    if format_id:
        args += ['--format', format_id]
    elif media_type == 'audio':
        args += ['--extract-audio', '--audio-format', audio_format]
        quality_map = {'best': '0', '320k': '0', '256k': '5', '192k': '5', '128k': '7'}
        args += ['--audio-quality', quality_map.get(quality, '5')]
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
    return args


def run_download(app, task_id: str, url: str, options: dict, user_id: str) -> None:
    with app.app_context():
        process = None
        last_lines: list[str] = []
        stall_reason = ['']
        try:
            args = _build_download_args(user_id, url, options)

            with download_lock:
                download_progress[task_id] = {
                    'status': 'downloading', 'percent': 0,
                    'speed': '', 'eta': '', 'filename': '',
                }

            log.info('Starting download %s url=%s', task_id, url)
            process = subprocess.Popen(
                args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1, start_new_session=True,
            )
            with download_lock:
                download_processes[task_id] = process

            started_at = time.time()
            last_output_at = [time.time()]
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
                        kill_process(process)
                        return
                    if now - started_at > MAX_DOWNLOAD_SECONDS:
                        stall_reason[0] = (
                            f'Download exceeded the {MAX_DOWNLOAD_SECONDS // 60}-minute limit.'
                        )
                        kill_process(process)
                        return

            threading.Thread(target=watchdog, daemon=True).start()

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
                        filename = dest_match.group(1).strip()
                        prog['filename'] = filename
                    if merge_match:
                        filename = merge_match.group(1).strip()
                        prog['filename'] = filename
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
                err = stall_reason[0] or extract_error(last_lines) or 'Download failed'
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
            err = stall_reason[0] or str(e)
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
                kill_process(process)


def recover_stuck_on_startup(app) -> None:
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
