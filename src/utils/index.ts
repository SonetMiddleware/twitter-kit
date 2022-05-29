export function getUserID(x: string) {
  if (!x) return null
  const relative = !x.startsWith('https://') && !x.startsWith('http://')
  const url = relative ? new URL(x, location.host) : new URL(x)

  if (url.hostname !== 'twitter.com' && url.hostname !== 'mobile.twitter.com')
    return null
  if (url.pathname.endsWith('.php')) {
    if (!url.search) return null
    const search = new URLSearchParams(url.search)
    return search.get('id')
  }
  const val = url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')[0]
  if (val === 'me') return null
  return val
}
