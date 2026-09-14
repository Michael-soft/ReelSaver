from app.extensions import db


class Setting(db.Model):
    __tablename__ = 'settings'

    user_id = db.Column(db.String, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String, nullable=True)
