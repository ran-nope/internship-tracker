import { Component } from 'react'
import { ChartNoAxesCombined } from 'lucide-react'

// A failed optional chart chunk must not take authentication or CRUD offline.
export default class ChartBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="panel empty-state" role="alert">
          <ChartNoAxesCombined size={27} />
          <h3>Analytics couldn’t load</h3>
          <p>
            Your applications are still available below. Reload the page when
            your connection is restored to try the charts again.
          </p>
          <button
            className="secondary-button"
            onClick={this.props.onApplications}
          >
            Go to applications
          </button>
        </section>
      )
    }
    return this.props.children
  }
}
