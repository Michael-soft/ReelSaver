from datetime import datetime

from app import db
from flask_login import UserMixin


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=True, index=True)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    google_id = db.Column(db.String(64), unique=True, nullable=True, index=True)
    auth_provider = db.Column(db.String(16), nullable=False, default='local')
    first_name = db.Column(db.String, nullable=True)
    last_name = db.Column(db.String, nullable=True)
    profile_image_url = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Download(db.Model):
    __tablename__ = 'downloads'
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Setting(db.Model):
    __tablename__ = 'settings'
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String, nullable=True)


class Template(db.Model):
    __tablename__ = 'templates'
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    command = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
