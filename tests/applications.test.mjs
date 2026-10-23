import test from 'node:test'
import assert from 'node:assert/strict'
import {
  summarizeApplications,
  filterApplications,
  buildApplicationTrend,
  formatDate,
} from '../frontend/src/utils/applications.js'
const items = [
  {
    id: 1,
    company: 'Zen',
    role: 'Developer',
    location: 'Delhi',
    status: 'Applied',
    application_date: '2026-01-01',
  },
  {
    id: 2,
    company: 'alpha',
    role: 'Designer',
    location: null,
    status: 'Interview',
    application_date: '2026-03-01',
  },
  {
    id: 3,
    company: 'Beta',
    role: 'Engineer',
    location: 'Bengaluru',
    status: 'Offer',
    application_date: '2026-03-01',
  },
  {
    id: 4,
    company: 'Alpha',
    role: 'Engineer',
    location: 'Remote',
    status: 'Selected',
    application_date: '2026-02-28',
  },
]
test('summary has exact status counts, offer separation and empty-state rates', () => {
  const result = summarizeApplications(items)
  assert.equal(result.total, 4)
  assert.equal(result.counts.Interview, 1)
  assert.equal(result.counts.Offer, 1)
  assert.equal(result.counts.Selected, 1)
  assert.equal(result.selectionRate, '25.0')
  assert.equal(result.active, 3)
  assert.equal(summarizeApplications([]).selectionRate, '0.0')
  assert.equal(
    Object.values(result.counts).reduce((a, b) => a + b, 0),
    4,
  )
})
test('combined search, status and sorting are deterministic without mutating input', () => {
  assert.deepEqual(
    filterApplications(items).map((x) => x.id),
    [3, 2, 4, 1],
  )
  assert.deepEqual(
    filterApplications(items, { sort: 'oldest' }).map((x) => x.id),
    [1, 4, 2, 3],
  )
  assert.deepEqual(
    filterApplications(items, { sort: 'company' }).map((x) => x.id),
    [2, 4, 3, 1],
  )
  assert.deepEqual(
    filterApplications(items, { search: '  ENGINEER  ', status: 'Offer' }).map(
      (x) => x.id,
    ),
    [3],
  )
  assert.equal(filterApplications(items, { search: 'bengaluru' }).length, 1)
  assert.equal(filterApplications(items, { search: 'missing' }).length, 0)
  assert.deepEqual(
    items.map((x) => x.id),
    [1, 2, 3, 4],
  )
})
test('calendar trend includes zero months and boundaries without timezone conversion', () => {
  const trend = buildApplicationTrend(items, '6', new Date(2026, 2, 15))
  assert.equal(trend.length, 6)
  assert.deepEqual(
    trend.map((x) => x.applications),
    [0, 0, 0, 1, 1, 2],
  )
  assert.equal(trend.at(-1).fullLabel, 'Mar 2026')
  assert.equal(
    buildApplicationTrend(items, '12', new Date(2026, 2, 1)).length,
    12,
  )
  assert.equal(formatDate('2026-01-01'), '1 Jan 2026')
  assert.equal(buildApplicationTrend([], '6', new Date(2026, 0, 1)).length, 6)
})
test('all-time aggregation preserves totals and bounds chart complexity', () => {
  const values = [
    ...items,
    { ...items[0], id: 5, application_date: '2000-01-01' },
    { ...items[0], id: 6, application_date: '2027-01-01' },
  ]
  const trend = buildApplicationTrend(values, 'all', new Date(2026, 2, 1))
  assert.ok(trend.length <= 24)
  assert.equal(
    trend.reduce((sum, x) => sum + x.applications, 0),
    values.length,
  )
  assert.equal(
    buildApplicationTrend(
      [{ application_date: 'invalid' }],
      '6',
      new Date(2026, 2, 1),
    ).at(-1).applications,
    0,
  )
})
