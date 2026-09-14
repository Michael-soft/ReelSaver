from datetime import datetime

from app.extensions import db


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

    def serialize(self) -> dict:
        return {
            'id': self.id,
            'url': self.url,
            'title': self.title,
            'thumbnail': self.thumbnail,
            'uploader': self.uploader,
            'duration': self.duration,
            'media_type': self.media_type,
            'format_id': self.format_id,
            'ext': self.ext,
            'filename': self.filename,
            'filesize': self.filesize,
            'status': self.status,
            'error': self.error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
