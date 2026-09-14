import os

from app.config import Config
from app.extensions import db
from app.models import Setting


def get_setting(user_id: str, key: str, default=None):
    row = db.session.get(Setting, (user_id, key))
    return row.value if row else default


def set_setting(user_id: str, key: str, value) -> None:
    row = db.session.get(Setting, (user_id, key))
    if row:
        row.value = str(value)
    else:
        row = Setting(user_id=user_id, key=key, value=str(value))
        db.session.add(row)
    db.session.commit()


def user_cookie_path(user_id: str) -> str:
    return os.path.join(Config.COOKIES_DIR, f'cookies_{user_id}.txt')
