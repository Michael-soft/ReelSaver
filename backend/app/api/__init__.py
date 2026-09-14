from flask import Blueprint

from app.api.account import account_bp
from app.api.downloads import downloads_bp
from app.api.history import history_bp
from app.api.settings import settings_bp
from app.api.templates import templates_bp
from app.api.command import command_bp
from app.api.system import system_bp

api_bp = Blueprint('api', __name__, url_prefix='/api')

for _bp in (account_bp, downloads_bp, history_bp, settings_bp,
            templates_bp, command_bp, system_bp):
    api_bp.register_blueprint(_bp)
