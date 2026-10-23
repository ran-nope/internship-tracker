import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChartNoAxesCombined } from 'lucide-react'
import {
  buildApplicationTrend,
  STATUS_COLORS,
  STATUSES,
} from '../utils/applications'

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="chart-tooltip">
      <strong>{data.fullLabel}</strong>
      <span>
        {data.applications}{' '}
        {data.applications === 1 ? 'application' : 'applications'}
      </span>
    </div>
  )
}

export default function AnalyticsCharts({ items, summary, onStatus }) {
  const [range, setRange] = useState('6')
  const trend = useMemo(
    () => buildApplicationTrend(items, range),
    [items, range],
  )
  const distribution = STATUSES.map((name) => ({
    name,
    value: summary.counts[name],
  })).filter((item) => item.value)
  const inRange = trend.reduce((sum, bucket) => sum + bucket.applications, 0)
  return (
    <div className="charts-grid">
      <section className="panel trend-panel" aria-labelledby="trend-heading">
        <div className="panel-heading">
          <div>
            <h2 id="trend-heading">Application momentum</h2>
            <p>Your applications over time</p>
          </div>
          <select
            aria-label="Trend date range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="all">All time</option>
          </select>
        </div>
        <div className="trend-summary">
          <strong>{inRange}</strong>
          <span>applications in this range</span>
          <span className="chart-series-key">
            <i />
            Applications
          </span>
        </div>
        <div
          className="trend-chart"
          role="group"
          aria-label="Application trend chart"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            debounce={80}
          >
            <AreaChart
              data={trend}
              accessibilityLayer
              margin={{ top: 12, right: 10, left: -28, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="application-gradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--chart-accent)"
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-accent)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--chart-grid)"
                strokeDasharray="3 5"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={25}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: 'var(--border)' }}
              />
              <Area
                type="monotone"
                dataKey="applications"
                name="Applications"
                stroke="var(--chart-accent)"
                strokeWidth={2.5}
                fill="url(#application-gradient)"
                isAnimationActive={false}
                activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--surface)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-footnote">
          Grouped by application date · Empty months are included
        </p>
        <details className="chart-data">
          <summary>View trend data</summary>
          <table>
            <caption className="sr-only">Applications by date range</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Applications</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((bucket) => (
                <tr key={bucket.key}>
                  <th scope="row">{bucket.fullLabel}</th>
                  <td>{bucket.applications}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section className="panel status-panel" aria-labelledby="status-heading">
        <div className="panel-heading">
          <div>
            <h2 id="status-heading">Your application pipeline</h2>
            <p>Current status · All time</p>
          </div>
          <ChartNoAxesCombined className="muted" size={19} />
        </div>
        <div className="distribution-layout">
          <div
            className="donut-wrap"
            role="group"
            aria-label="Applications by current status"
          >
            {distribution.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart accessibilityLayer>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      color: 'var(--text)',
                    }}
                    itemStyle={{ color: 'var(--text)' }}
                  />
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="70%"
                    outerRadius="95%"
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                    isAnimationActive={false}
                    onClick={(entry) => onStatus(entry.name)}
                  >
                    {distribution.map((item) => (
                      <Cell
                        key={item.name}
                        fill={STATUS_COLORS[item.name]}
                        cursor="pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-donut" />
            )}
            <div className="donut-center" aria-hidden="true">
              <strong>{summary.total}</strong>
              <span>Total applications</span>
            </div>
          </div>
          <div className="status-legend">
            {STATUSES.map((status) => (
              <button
                key={status}
                className="legend-row"
                onClick={() => onStatus(status)}
                aria-label={`Filter status: ${status} (${summary.counts[status]})`}
              >
                <i style={{ background: STATUS_COLORS[status] }} />
                <span>{status}</span>
                <strong>{summary.counts[status]}</strong>
              </button>
            ))}
          </div>
        </div>
        <p className="chart-footnote">
          Select a status to explore your applications.
        </p>
      </section>
    </div>
  )
}
