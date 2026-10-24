"""Small direct ASGI client; no network, credentials, or third-party client."""
import asyncio
import json


def request(app, method='GET', path='/', body=b'', headers=(), forbid_receive=False):
    async def run():
        messages = []
        async def receive():
            if forbid_receive:
                raise AssertionError('Blocked request body must never be consumed')
            return {'type': 'http.request', 'body': body, 'more_body': False}
        async def send(message):
            messages.append(message)
        scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                 'method': method, 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
                 'query_string': b'', 'root_path': '',
                 'headers': [(b'host', b'testserver'), *headers],
                 'client': ('127.0.0.1', 1234), 'server': ('testserver', 80)}
        await app(scope, receive, send)
        start = next(message for message in messages if message['type'] == 'http.response.start')
        raw = b''.join(message.get('body', b'') for message in messages if message['type'] == 'http.response.body')
        try:
            data = json.loads(raw)
        except ValueError:
            data = raw
        return start['status'], dict(start['headers']), data
    return asyncio.run(run())
