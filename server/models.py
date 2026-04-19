from datetime import datetime

from app import db
from flask_dance.consumer.storage.sqla import OAuthConsumerMixin
from flask_login import UserMixin
from sqlalchemy import UniqueConstraint


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=True)
    first_name = db.Column(db.String, nullable=True)
    last_name = db.Column(db.String, nullable=True)
    profile_image_url = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)


class OAuth(OAuthConsumerMixin, db.Model):
    user_id = db.Column(db.String, db.ForeignKey(User.id))
    browser_session_key = db.Column(db.String, nullable=False)
    user = db.relationship(User)

    __table_args__ = (UniqueConstraint(
        'user_id',
        'browser_session_key',
        'provider',
        name='uq_user_browser_session_key_provider',
    ),)


class Download(db.Model):
    __tablename__ = 'downloads'
    id = db.Column(db.String, primary_key=True)
    url = db.Column(db.String, nullable=False)
    title = db.Column(db.String, nullable=True)
    thumbnail = db.Column(db.String, nullable=True)
    uploader = db.Column(db.String, nullable=True)
    duration = db.Column(db.Integer, nullable=True)
    media_type = db.Column(db.String, nullable=True)
    format_id = db.Column(db.String, nullable=True)
    ext = db.Column(db.String, nullable=True)
    filename = db.Column(db.String, nullable=True)
    filesize = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String, default='pending')
    error = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)


class Setting(db.Model):
    __tablename__ = 'settings'
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String, nullable=True)


class Template(db.Model):
    __tablename__ = 'templates'
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    command = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
