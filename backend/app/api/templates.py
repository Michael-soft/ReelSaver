import uuid

from flask import Blueprint, jsonify, request

from app.auth import require_login
from app.extensions import db, limiter
from app.models import Template

templates_bp = Blueprint('templates', __name__)


@templates_bp.route('/templates', methods=['GET'])
@require_login
def get_templates():
    rows = db.session.query(Template).order_by(Template.created_at.desc()).all()
    return jsonify([r.serialize() for r in rows])


@templates_bp.route('/templates', methods=['POST'])
@require_login
@limiter.limit('20 per hour')
def create_template():
    data = request.json or {}
    name = (data.get('name') or '').strip()[:100]
    command = (data.get('command') or '').strip()[:1000]
    if not name or not command:
        return jsonify({'error': 'Name and command required'}), 400
    tid = str(uuid.uuid4())
    t = Template(id=tid, name=name, command=command)
    db.session.add(t)
    db.session.commit()
    return jsonify(t.serialize())


@templates_bp.route('/templates/<tid>', methods=['DELETE'])
@require_login
def delete_template(tid):
    t = db.session.get(Template, tid)
    if t:
        db.session.delete(t)
        db.session.commit()
    return jsonify({'success': True})
