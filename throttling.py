"""Bounded, process-local auth throttle. Multi-worker deployments need a shared limiter."""
from collections import OrderedDict, deque
import math
import threading
import time
from starlette.responses import JSONResponse


class AuthThrottle:
    def __init__(self, app, attempts=10, window=60, max_clients=10000):
        self.app, self.attempts, self.window, self.max_clients = app, attempts, window, max_clients
        self.clients = OrderedDict()
        self.lock = threading.Lock()

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope['method'] == 'POST' and scope['path'] in {'/login', '/signup', '/auth/login', '/auth/signup'}:
            # Do not trust user-supplied Forwarded/X-Forwarded-For headers.
            key = (scope.get('client') or ('unknown',))[0]
            now = time.monotonic()
            with self.lock:
                while self.clients and now - next(iter(self.clients.values()))[-1] >= self.window:
                    self.clients.popitem(last=False)
                if key not in self.clients and len(self.clients) >= self.max_clients:
                    retry = self.window
                else:
                    events = self.clients.setdefault(key, deque())
                    while events and now - events[0] >= self.window:
                        events.popleft()
                    retry = max(1, math.ceil(self.window - (now-events[0]))) if len(events) >= self.attempts else 0
                    if not retry:
                        events.append(now)
                        self.clients.move_to_end(key)
            if retry:
                response = JSONResponse({'detail': 'Too many authentication attempts. Try again shortly.'}, status_code=429, headers={'Retry-After': str(retry), 'Cache-Control': 'no-store'})
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
