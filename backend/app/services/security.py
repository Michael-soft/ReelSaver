import ipaddress
import os
from urllib.parse import urlparse

MAX_URL_LENGTH = 2048

_BLOCKED_HOSTS = {
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    'metadata.google.internal', '169.254.169.254',
}


def validate_url(url: str) -> tuple[bool, str]:
    """Validate a user-supplied URL, blocking SSRF vectors."""
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


def sanitize_filename(name: str) -> str:
    """Return just the basename, no path separators."""
    return os.path.basename(name.replace('\\', '/'))
