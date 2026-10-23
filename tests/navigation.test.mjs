import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLocation, routeHref } from '../frontend/src/utils/navigation.js'

test('public and protected hash routes survive refresh without server rewrites', () => {
  assert.equal(parseLocation('').route, 'home')
  for (const route of ['home', 'login', 'signup', 'overview', 'applications']) {
    assert.equal(parseLocation(routeHref(route)).route, route)
  }
  assert.equal(parseLocation('#/unknown').route, 'not-found')
  assert.equal(parseLocation('#/login?next=applications').next, 'applications')
})
test('return destinations and section navigation are strictly allowlisted', () => {
  for (const next of [
    'https://evil.example',
    '//evil.example',
    'javascript:alert(1)',
    '/applications',
    'home',
  ]) {
    assert.equal(
      parseLocation(`#/login?next=${encodeURIComponent(next)}`).next,
      'overview',
    )
  }
  assert.equal(routeHref('login', { next: 'https://evil.example' }), '#/login')
  assert.equal(
    parseLocation(routeHref('home', { section: 'features' })).section,
    'features',
  )
  assert.equal(parseLocation('#/login?section=features').section, null)
  assert.equal(parseLocation('#/?section=unknown').section, null)
  assert.throws(() => routeHref('unknown'), /Unknown/)
})
