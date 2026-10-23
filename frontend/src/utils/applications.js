export const STATUSES = [
  'Applied',
  'Assessment',
  'Interview',
  'Offer',
  'Selected',
  'Rejected',
  'Withdrawn',
]
export const STATUS_COLORS = {
  Applied: '#7868d8',
  Assessment: '#ac94c4',
  Interview: '#bf964f',
  Offer: '#548f7a',
  Selected: '#7e9b60',
  Rejected: '#bd7e86',
  Withdrawn: '#8d9187',
}
export const EMPTY_FORM = {
  company: '',
  role: '',
  status: 'Applied',
  application_date: '',
  location: '',
  job_url: '',
  notes: '',
}

export function summarizeApplications(items) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]))
  for (const item of items)
    if (Object.hasOwn(counts, item.status)) counts[item.status]++
  return {
    total: items.length,
    counts,
    selectionRate: items.length
      ? ((counts.Selected / items.length) * 100).toFixed(1)
      : '0.0',
    active:
      counts.Applied + counts.Assessment + counts.Interview + counts.Offer,
  }
}

export function filterApplications(
  items,
  { search = '', status = 'All', sort = 'newest' } = {},
) {
  const query = search.trim().toLocaleLowerCase()
  return items
    .filter(
      (item) =>
        (status === 'All' || item.status === status) &&
        [item.company, item.role, item.location || ''].some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
    )
    .sort((a, b) => {
      if (sort === 'company') {
        const company = a.company.localeCompare(b.company, 'en', {
          sensitivity: 'base',
          numeric: true,
        })
        if (company) return company
      }
      const date = a.application_date.localeCompare(b.application_date)
      return sort === 'oldest' ? date || a.id - b.id : -date || b.id - a.id
    })
}

function monthIndex(value) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value || '')
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null
  return Number(match[1]) * 12 + Number(match[2]) - 1
}
function monthLabel(index, includeYear = false) {
  const date = new Date(0)
  date.setUTCFullYear(Math.floor(index / 12), index % 12, 1)
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

// Calendar-month buckets avoid timezone shifts and include months with no records.
// All-time ranges are grouped into at most 24 buckets to keep charts responsive.
export function buildApplicationTrend(items, range = '6', now = new Date()) {
  const current = now.getFullYear() * 12 + now.getMonth()
  const dates = items
    .map((item) => monthIndex(item.application_date))
    .filter((index) => index !== null)
  let end = current
  let start = current - (range === '12' ? 11 : 5)
  if (range === 'all' && dates.length) {
    start = dates.reduce((minimum, index) => Math.min(minimum, index), current)
    end = dates.reduce((maximum, index) => Math.max(maximum, index), current)
  }
  const step = Math.max(1, Math.ceil((end - start + 1) / 24))
  const buckets = []
  for (let index = start; index <= end; index += step) {
    const last = Math.min(index + step - 1, end)
    buckets.push({
      key: index,
      label: monthLabel(index, end - start >= 12),
      fullLabel:
        index === last
          ? monthLabel(index, true)
          : `${monthLabel(index, true)} – ${monthLabel(last, true)}`,
      applications: 0,
    })
  }
  for (const index of dates) {
    if (index >= start && index <= end)
      buckets[Math.floor((index - start) / step)].applications++
  }
  return buckets
}

export function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
