import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../frontend/src/api.js', import.meta.url), 'utf8')
async function load(env) {
  const code = source.replaceAll('import.meta.env', JSON.stringify(env))
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

test('URL joining, auth headers, validation messages, and session expiry', async () => {
  const api = await load({ VITE_API_URL: ' https://api.example/// ', PROD: true })
  for (const value of ['localhost:8000', 'ftp://api.example', 'https://user:password@api.example', 'https://api.example?token=secret']) {
    assert.throws(() => api.normalizeApiUrl(value), /VITE_API_URL/)
  }
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => [] }
  }
  await api.apiRequest('///internships', {method: 'POST', body: '{}'}, 'test-token')
  assert.equal(request.url, 'https://api.example/internships')
  assert.equal(request.options.headers.Authorization, 'Bearer test-token')
  assert.equal(request.options.headers['Content-Type'], 'application/json')
  const production = await load({ PROD: true })
  await production.apiRequest('/login')
  assert.equal(request.url, 'https://internship-tracker-ak3q.onrender.com/login')
  const blank = await load({ VITE_API_URL: '   ', PROD: true })
  await blank.apiRequest('/signup')
  assert.equal(request.url, 'https://internship-tracker-ak3q.onrender.com/signup')
  globalThis.fetch = async () => ({ok: false, status: 422, json: async () => ({detail: [{loc: ['body', 'password'], msg: 'Too long'}]})})
  await assert.rejects(api.apiRequest('/signup'), /body.password: Too long/)
  let removed = 0
  let reloaded = 0
  globalThis.localStorage = {getItem: () => 'new-token', removeItem: () => {removed++}}
  globalThis.window = {location: {reload: () => {reloaded++}}}
  globalThis.fetch = async () => ({ok: false, status: 401, json: async () => ({detail: 'Expired'})})
  await assert.rejects(api.apiRequest('/internships', {}, 'old-token'), /Expired/)
  assert.equal(removed, 0)
  assert.equal(reloaded, 0)
  await assert.rejects(api.apiRequest('/internships', {}, 'new-token'), /Expired/)
  assert.equal(removed, 2)
  assert.equal(reloaded, 1)
})
