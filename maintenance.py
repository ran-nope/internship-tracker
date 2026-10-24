"""Process-local maintenance configuration and an early ASGI request gate.

No environment loading, database access, HTTP bypass, or runtime toggle lives here.
An instance's status is never evidence that older instances have stopped.
"""
from dataclasses import dataclass, field
import re
from uuid import uuid4

from starlette.responses import JSONResponse

MESSAGE = 'The application is temporarily read-only for database maintenance. Please try again later.'
SAFE_METHODS = frozenset({'GET', 'HEAD', 'OPTIONS'})
# These existing POST operations only check credentials and issue a JWT.
READ_ONLY_POST_PATHS = frozenset({'/login', '/login/'})


@dataclass(frozen=True)
class RuntimeSettings:
    maintenance_mode: bool = False
    release: str = 'local'
    instance_id: str = field(default_factory=lambda: uuid4().hex)

    @classmethod
    def from_environment(cls, environment):
        value = environment.get('MAINTENANCE_MODE', 'false').strip().lower()
        if value not in {'true', 'false'}:
            # Never include an invalid environment value in diagnostics.
            raise RuntimeError('MAINTENANCE_MODE must be true or false')
        candidate = environment.get('RENDER_GIT_COMMIT', '')
        release = candidate.lower() if re.fullmatch(r'[0-9a-fA-F]{7,40}', candidate) else 'local'
        return cls(maintenance_mode=value == 'true', release=release)

    def status(self):
        return {'maintenance_mode': self.maintenance_mode,
                'release': self.release, 'instance_id': self.instance_id}


class MaintenanceMiddleware:
    def __init__(self, app, enabled=False):
        self.app = app
        self.enabled = enabled

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and self.enabled:
            method = scope['method']
            read_only_login = method == 'POST' and scope['path'] in READ_ONLY_POST_PATHS
            if method not in SAFE_METHODS and not read_only_login:
                response = JSONResponse({'detail': MESSAGE}, status_code=503,
                                        headers={'Cache-Control': 'no-store'})
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
