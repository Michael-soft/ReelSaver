import os

from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func

from app.auth import require_login
from app.config import Config
from app.extensions import db
from app.models import Download
from app.services.security import sanitize_filename

history_bp = Blueprint('history', __name__)


def _remove_file(filename: str) -> None:
    if not filename:
        return
    fp = os.path.join(Config.DOWNLOADS_DIR, sanitize_filename(filename))
    if os.path.exists(fp):
        os.remove(fp)


@history_bp.route('/history', methods=['GET'])
@require_login
def get_history():
    search = request.args.get('search', '')
    media_type = request.args.get('type', '')
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('perPage', 20))))

    query = db.session.query(Download).filter(Download.user_id == current_user.id)
    if search:
        like = f'%{search}%'
        query = query.filter(
            Download.title.ilike(like) |
            Download.url.ilike(like) |
            Download.uploader.ilike(like)
        )
    if media_type in ('video', 'audio'):
        query = query.filter(Download.media_type == media_type)

    total = query.count()
    rows = (query.order_by(Download.created_at.desc())
            .offset((page - 1) * per_page).limit(per_page).all())

    return jsonify({
        'items': [r.serialize() for r in rows],
        'total': total, 'page': page, 'perPage': per_page,
    })


@history_bp.route('/history/<task_id>', methods=['DELETE'])
@require_login
def delete_history(task_id):
    dl = db.session.get(Download, task_id)
    if dl and dl.user_id and dl.user_id != current_user.id:
        return jsonify({'error': 'Forbidden'}), 403
    if dl:
        _remove_file(dl.filename)
        db.session.delete(dl)
        db.session.commit()
    return jsonify({'success': True})


@history_bp.route('/history', methods=['DELETE'])
@require_login
def clear_history():
    ids = request.json.get('ids', []) if request.json else []
    base_query = db.session.query(Download).filter(Download.user_id == current_user.id)
    if ids:
        safe_ids = [str(i) for i in ids if isinstance(i, str)]
        rows = base_query.filter(Download.id.in_(safe_ids)).all()
    else:
        rows = base_query.all()
    for dl in rows:
        _remove_file(dl.filename)
        db.session.delete(dl)
    db.session.commit()
    return jsonify({'success': True})


@history_bp.route('/stats', methods=['GET'])
@require_login
def get_stats():
    base = db.session.query(Download).filter(Download.user_id == current_user.id)
    total_size = db.session.query(func.sum(Download.filesize)).filter(
        Download.status == 'completed',
        Download.user_id == current_user.id,
    ).scalar() or 0
    recent = base.order_by(Download.created_at.desc()).limit(5).all()

    return jsonify({
        'total': base.count(),
        'completed': base.filter(Download.status == 'completed').count(),
        'failed': base.filter(Download.status == 'failed').count(),
        'downloading': base.filter(Download.status == 'downloading').count(),
        'audioCount': base.filter(Download.media_type == 'audio').count(),
        'videoCount': base.filter(Download.media_type == 'video').count(),
        'totalSize': total_size,
        'recent': [r.serialize() for r in recent],
    })
