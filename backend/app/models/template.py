from datetime import datetime

from app.extensions import db


class Template(db.Model):
    __tablename__ = 'templates'

    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    command = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def serialize(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'command': self.command,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
