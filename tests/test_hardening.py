import asyncio
import pytest
from pydantic import ValidationError
from schemas import SignupUser, LoginUser
from throttling import AuthThrottle
from asgi_helpers import request


@pytest.mark.parametrize('password', ['a', 'alllowercase', 'ALLUPPERCASE1', 'NoDigitsHere'])
def test_signup_password_policy(password):
    with pytest.raises(ValidationError):
        SignupUser(username='example', password=password)
    assert LoginUser(username='example', password=password).password == password


def test_auth_throttle_and_retry_header():
    async def downstream(scope, receive, send):
        await send({'type': 'http.response.start', 'status': 200, 'headers': []})
        await send({'type': 'http.response.body', 'body': b'{}'})
    app = AuthThrottle(downstream, attempts=2)
    assert request(app, 'POST', '/auth/login')[0] == 200
    assert request(app, 'POST', '/auth/signup')[0] == 200
    status, headers, _ = request(app, 'POST', '/login')
    assert status == 429 and int(headers[b'retry-after']) > 0
    assert request(app, 'GET', '/status')[0] == 200
