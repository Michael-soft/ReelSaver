import json
import os
import re
import subprocess
from urllib.parse import urlparse

from app.services.settings_service import get_setting, user_cookie_path

_RATE_RE = re.compile(r'^\d+(\.\d+)?[KMGkmg]?$')


def build_yt_dlp_args(user_id: str, settings: dict | None = None) -> list[str]:
    args = [
        'yt-dlp',
        '--socket-timeout', '30',
        '--retries', '3',
        '--fragment-retries', '3',
        '--no-warnings',
    ]
    settings = settings or {}

    proxy = settings.get('proxy', get_setting(user_id, 'proxy', '')).strip()
    if proxy:
        parsed = urlparse(proxy)
        if parsed.scheme in ('http', 'https', 'socks4', 'socks5', 'socks4a', 'socks5h'):
            args += ['--proxy', proxy]

    rate_limit = settings.get('rateLimit', get_setting(user_id, 'rateLimit', '')).strip()
    if rate_limit and _RATE_RE.match(rate_limit):
        args += ['--limit-rate', rate_limit]

    cookie_path = user_cookie_path(user_id)
    if os.path.exists(cookie_path):
        args += ['--cookies', cookie_path]

    return args


def fetch_info(user_id: str, url: str) -> dict:
    args = build_yt_dlp_args(user_id) + [
        '--dump-json', '--no-playlist', '--skip-download', '--', url
    ]
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired as e:
        raise TimeoutError('Request timed out') from e
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'Failed to fetch info')
    data = json.loads(result.stdout.strip())
    return {
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
        'formats': [{
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
        } for f in data.get('formats', [])],
    }


def fetch_playlist(user_id: str, url: str) -> dict:
    args = build_yt_dlp_args(user_id) + [
        '--flat-playlist', '--dump-json', '--yes-playlist', '--', url
    ]
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired as e:
        raise TimeoutError('Request timed out') from e
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'Failed to fetch playlist')
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
    return {'items': items, 'count': len(items)}


def get_version() -> str:
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=10)
        return result.stdout.strip() if result.returncode == 0 else 'unknown'
    except Exception:
        return 'unknown'


def update_ytdlp() -> dict:
    result = subprocess.run(
        ['pip', 'install', '--upgrade', 'yt-dlp'],
        capture_output=True, text=True, timeout=120,
    )
    return {
        'success': result.returncode == 0,
        'version': get_version(),
        'output': (result.stdout + result.stderr)[-1500:],
    }


ALLOWED_COMMAND_FLAGS = [
    '--extract-audio', '--audio-format', '--audio-quality', '--format',
    '--embed-thumbnail', '--embed-metadata', '--embed-subs',
    '--write-subs', '--sub-langs', '--remux-video', '--limit-rate',
    '--sponsorblock-remove', '--no-playlist', '--yes-playlist',
    '--flat-playlist',
]


def build_safe_command(command: str, output_dir: str, url: str) -> list[str]:
    """Parse a user command string, keeping only allow-listed flags."""
    cmd_parts = command.split() if command else []
    safe_args = ['yt-dlp']
    i = 0
    while i < len(cmd_parts):
        part = cmd_parts[i]
        if part in ALLOWED_COMMAND_FLAGS:
            safe_args.append(part)
            if i + 1 < len(cmd_parts) and not cmd_parts[i + 1].startswith('--'):
                i += 1
                safe_args.append(cmd_parts[i])
        i += 1
    safe_args += ['--output', os.path.join(output_dir, '%(title)s.%(ext)s'), url]
    return safe_args
