import { ArrowUpRight } from 'lucide-react'
import { routeHref } from '../utils/navigation'

export default function Brand({ className = '' }) {
  return (
    <a
      className={`brand product-brand ${className}`}
      href={routeHref('home')}
      aria-label="Internship Tracker home"
    >
      <span className="brand-mark">
        <ArrowUpRight size={23} />
        <i />
      </span>
      <span className="brand-name">
        Internship
        <span>
          Tracker<span className="brand-period">.</span>
        </span>
      </span>
    </a>
  )
}
