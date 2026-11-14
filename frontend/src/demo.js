import { filterApplications, summarizeApplications } from './utils/applications'
const key = 'synthetic-demo-records'
function records() {
  const stored = sessionStorage.getItem(key)
  if (stored) return JSON.parse(stored)
  const rows = Array.from({length: 18}, (_, i) => ({id: i + 1, company: `Fictional Company ${i + 1}`, role: 'Engineering Intern', status: ['Applied','Interview','Offer'][i % 3], application_date: `2026-10-${String(i + 1).padStart(2,'0')}`, location: 'Demo City', notes: 'Fictional example; not a real application.', job_url: null}))
  sessionStorage.setItem(key, JSON.stringify(rows))
  return rows
}
export async function demoRequest(path, options = {}) {
  const url = new URL(path, 'https://demo.invalid')
  let rows = records()
  if (url.pathname === '/internships/summary') return {...summarizeApplications(rows), months: rows.map(({application_date}) => ({application_date, count: 1}))}
  const method = options.method || 'GET'
  if (method === 'GET') {
    const filtered = filterApplications(rows, Object.fromEntries(url.searchParams))
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 8)
    return {items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit}
  }
  const id = Number(url.pathname.split('/').pop())
  let result
  if (method === 'DELETE') rows = rows.filter(row => row.id !== id)
  else {
    result = {...JSON.parse(options.body), id: method === 'POST' ? Math.max(0,...rows.map(row => row.id)) + 1 : id}
    rows = method === 'POST' ? [...rows, result] : rows.map(row => row.id === id ? result : row)
  }
  sessionStorage.setItem(key, JSON.stringify(rows))
  return result || {message: 'Demo record removed'}
}
