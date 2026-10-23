const paths = {
  home: '/',
  login: '/login',
  signup: '/signup',
  overview: '/overview',
  applications: '/applications',
}
export const PROTECTED_ROUTES = ['overview', 'applications']

export function parseLocation(hash = '') {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const route =
    Object.keys(paths).find((key) => paths[key] === (path || '/')) ||
    'not-found'
  const params = new URLSearchParams(query)
  const requested = params.get('next')
  return {
    route,
    next: PROTECTED_ROUTES.includes(requested) ? requested : 'overview',
    section:
      route === 'home' &&
      ['features', 'workspace', 'approach'].includes(params.get('section'))
        ? params.get('section')
        : null,
  }
}

export function routeHref(route, { next, section } = {}) {
  if (!Object.hasOwn(paths, route)) throw new Error('Unknown application route')
  const params = new URLSearchParams()
  if (PROTECTED_ROUTES.includes(next)) params.set('next', next)
  if (
    route === 'home' &&
    ['features', 'workspace', 'approach'].includes(section)
  )
    params.set('section', section)
  const query = params.toString()
  return `#${paths[route]}${query ? `?${query}` : ''}`
}
