import {
  ArrowUpRight,
  LayoutDashboard,
  BriefcaseBusiness,
  Plus,
  MoreHorizontal,
  Search,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'

// An intentionally static illustration. It never reads session or application data.
const examples = [
  {
    initials: 'N',
    company: 'Northstar Studio',
    role: 'Product Design Intern',
    status: 'Interview',
    location: 'Remote',
    date: '18 Oct',
  },
  {
    initials: 'O',
    company: 'Orbit Labs',
    role: 'Software Engineering Intern',
    status: 'Applied',
    location: 'Bengaluru',
    date: '16 Oct',
  },
  {
    initials: 'F',
    company: 'Forma',
    role: 'Frontend Development Intern',
    status: 'Offer',
    location: 'Remote',
    date: '12 Oct',
  },
]

export default function DashboardPreview() {
  return (
    <figure className="product-preview" aria-labelledby="preview-caption">
      <div
        className="preview-window"
        aria-label="Illustrative dashboard with sample data"
      >
        <div className="preview-sidebar" aria-hidden="true">
          <span className="preview-logo">
            <ArrowUpRight size={21} />
          </span>
          <span className="preview-workspace-label">WORKSPACE</span>
          <span className="preview-nav selected">
            <LayoutDashboard size={15} />
            Overview
          </span>
          <span className="preview-nav">
            <BriefcaseBusiness size={15} />
            Applications
          </span>
          <div className="preview-sidebar-bottom">
            <span className="preview-avatar">JD</span>
            <span>
              Demo workspace
              <br />
              <small>Illustrative account</small>
            </span>
          </div>
        </div>
        <div className="preview-main">
          <div className="preview-topline">
            <span>
              Workspace <span>/</span> Overview
            </span>
            <span className="preview-live">
              <i />
              Sample workspace
            </span>
          </div>
          <div className="preview-heading">
            <div>
              <span className="preview-eyebrow">
                A LITTLE CLARITY GOES A LONG WAY
              </span>
              <h3>Your search, in perspective.</h3>
            </div>
            <span className="preview-add" aria-hidden="true">
              <Plus size={13} />
              New application
            </span>
          </div>
          <div className="preview-metrics">
            {[
              ['Total applications', '12', 'A home for every opportunity'],
              ['Interviews', '03', 'Conversations in progress'],
              ['Offers', '01', 'A next chapter within reach'],
            ].map(([label, value, note]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {value}
                  <ArrowUpRight size={15} />
                </strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="preview-charts">
            <div className="preview-trend">
              <div className="preview-panel-title">
                <strong>Application momentum</strong>
                <span>
                  6 months <ChevronDown size={10} />
                </span>
              </div>
              <svg
                viewBox="0 0 560 145"
                className="preview-line-chart"
                role="img"
                aria-label="Illustrative applications per month: May 1, June 1, July 2, August 2, September 2, October 4"
              >
                <defs>
                  <linearGradient
                    id="preview-area-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="currentColor"
                      stopOpacity=".16"
                    />
                    <stop
                      offset="100%"
                      stopColor="currentColor"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {[25, 65, 105, 145].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="560"
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="3 5"
                  />
                ))}
                <path
                  d="M2 115 L112 115 L224 85 L336 85 L448 85 L558 25 L558 145 L2 145Z"
                  fill="url(#preview-area-fill)"
                />
                <path
                  d="M2 115 L112 115 L224 85 L336 85 L448 85 L558 25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <circle cx="558" cy="25" r="4" fill="currentColor" />
              </svg>
              <div className="preview-months" aria-hidden="true">
                {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((month) => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
            <div className="preview-pipeline">
              <div className="preview-panel-title">
                <strong>Current pipeline</strong>
                <MoreHorizontal size={14} aria-hidden="true" />
              </div>
              <div className="preview-pipeline-content">
                <div className="preview-ring" aria-hidden="true">
                  <span>
                    <strong>12</strong>
                    <small>applications</small>
                  </span>
                </div>
                <ul>
                  {[
                    ['Applied', 6],
                    ['Interview', 3],
                    ['Offer', 1],
                    ['Selected', 1],
                    ['Rejected', 1],
                  ].map(([status, count]) => (
                    <li key={status}>
                      <i
                        className={`preview-dot preview-dot-${status.toLowerCase()}`}
                      />
                      <span>{status}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="preview-records">
            <div className="preview-panel-title">
              <strong>
                Recent applications{' '}
                <span className="preview-count">3 of 12</span>
              </strong>
              <span aria-hidden="true">
                <Search size={13} />
                <MoreHorizontal size={15} />
              </span>
            </div>
            <table>
              <caption className="sr-only">
                Three fictional applications, shown as an illustrative product
                example
              </caption>
              <thead>
                <tr>
                  <th scope="col">Company & role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Location</th>
                  <th scope="col">Applied</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((item) => (
                  <tr key={item.company}>
                    <td>
                      <div className="preview-company">
                        <span>{item.initials}</span>
                        <div>
                          <strong>{item.company}</strong>
                          <small>{item.role}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-badge status-${item.status.toLowerCase()}`}
                      >
                        <i />
                        {item.status}
                      </span>
                    </td>
                    <td>{item.location}</td>
                    <td>
                      {item.date}
                      <ArrowRight size={12} aria-hidden="true" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <figcaption id="preview-caption">
        <span className="sample-label">ILLUSTRATIVE PREVIEW</span>
        <span>
          Sample data. Your own workspace starts with your applications.
        </span>
      </figcaption>
    </figure>
  )
}
