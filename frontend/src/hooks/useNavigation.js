import { useSyncExternalStore } from 'react'
import { parseLocation, routeHref } from '../utils/navigation'

let revision = 0

function subscribe(listener) {
  const events = ['hashchange', 'popstate', 'workspace:navigate']
  events.forEach((event) => window.addEventListener(event, listener))
  function revisit(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const link = event.target.closest?.('a[href^="#/"]')
    if (
      !link ||
      link.hasAttribute('download') ||
      (link.target && link.target !== '_self')
    )
      return
    if (
      link.hash !== window.location.hash ||
      parseLocation(link.hash).route === 'not-found'
    )
      return
    event.preventDefault()
    revision++
    window.dispatchEvent(new Event('workspace:navigate'))
  }
  document.addEventListener('click', revisit)
  return () => {
    events.forEach((event) => window.removeEventListener(event, listener))
    document.removeEventListener('click', revisit)
  }
}
function snapshot() {
  return JSON.stringify([window.location.hash, revision])
}

export function navigate(route, options = {}) {
  const href = routeHref(route, options)
  if (window.location.hash === href) {
    revision++
    window.dispatchEvent(new Event('workspace:navigate'))
    return
  }
  const method = options.replace ? 'replaceState' : 'pushState'
  window.history[method](null, '', href)
  window.dispatchEvent(new Event('workspace:navigate'))
}

export function useNavigation() {
  const location = useSyncExternalStore(subscribe, snapshot)
  const [hash] = JSON.parse(location)
  return { ...parseLocation(hash), location, navigate }
}
