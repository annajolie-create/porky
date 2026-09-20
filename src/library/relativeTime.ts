const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const onThisDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

export function relativeTime(timestamp: number, now = Date.now()) {
  const elapsed = now - timestamp
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return formatter.format(-Math.round(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return formatter.format(-Math.round(elapsed / HOUR), 'hour')
  if (elapsed < 7 * DAY) return formatter.format(-Math.round(elapsed / DAY), 'day')
  return onThisDay.format(timestamp)
}
