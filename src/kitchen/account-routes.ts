export function accountReturnPath(value?: string | null) {
  return value &&
    /^\/(?:discover|favorites|recent|mine|profile|settings|recipe\/[a-zA-Z0-9_-]+|read\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/.test(
      value,
    )
    ? value
    : '/profile'
}
export function accountPagePath(mode: 'login' | 'register', next = '/profile') {
  return `/${mode}?next=${encodeURIComponent(accountReturnPath(next))}`
}
