import re
import uuid

from flask import redirect, session
from flask_dance.consumer import oauth_authorized, oauth_error
from flask_dance.contrib.google import make_google_blueprint
from flask_login import login_user

from app.config import Config
from app.extensions import db
from app.models import User

google_bp = make_google_blueprint(
    client_id=Config.GOOGLE_OAUTH_CLIENT_ID,
    client_secret=Config.GOOGLE_OAUTH_CLIENT_SECRET,
    scope=[
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],
    offline=False,
    reprompt_consent=False,
)


@google_bp.before_app_request
def _google_session_init():
    if '_session_id' not in session:
        session['_session_id'] = uuid.uuid4().hex
        session.permanent = True


@oauth_authorized.connect_via(google_bp)
def google_logged_in(blueprint, token):
    if not token:
        return redirect('/?auth_error=google_no_token')

    resp = blueprint.session.get('/oauth2/v2/userinfo')
    if not resp.ok:
        return redirect('/?auth_error=google_userinfo')

    info = resp.json()
    google_id = info.get('id')
    email = (info.get('email') or '').lower() or None
    if not google_id:
        return redirect('/?auth_error=google_no_id')

    u = db.session.query(User).filter_by(google_id=google_id).first()
    if not u and email:
        u = db.session.query(User).filter_by(email=email).first()

    if u:
        u.google_id = google_id
        if email and not u.email:
            u.email = email
        if not u.first_name:
            u.first_name = info.get('given_name')
        if not u.last_name:
            u.last_name = info.get('family_name')
        if not u.profile_image_url:
            u.profile_image_url = info.get('picture')
        if u.auth_provider == 'local' and not u.password_hash:
            u.auth_provider = 'google'
    else:
        base_username = (info.get('email') or 'user').split('@')[0]
        base_username = re.sub(r'[^A-Za-z0-9_.-]', '', base_username)[:24] or 'user'
        username = base_username
        n = 1
        while db.session.query(User).filter_by(username=username).first():
            n += 1
            username = f'{base_username}{n}'
        u = User(
            id=str(uuid.uuid4()),
            username=username,
            email=email,
            google_id=google_id,
            first_name=info.get('given_name'),
            last_name=info.get('family_name'),
            profile_image_url=info.get('picture'),
            auth_provider='google',
        )
        db.session.add(u)

    db.session.commit()
    login_user(u, remember=True)
    return redirect('/app')


@oauth_error.connect_via(google_bp)
def google_error(blueprint, error, error_description=None, error_uri=None):
    return redirect(f"/?auth_error={error or 'google_oauth_error'}")
