export function isMatchMinuteTime(time: string) {
  return /^\d+(?:\+\d+)?'$/.test(time.trim())
}

export function formatTimelineTime(time: string, nowLabel: string, minuteLabel: string) {
  const normalizedTime = time.trim()

  if (!normalizedTime) {
    return nowLabel
  }

  if (isMatchMinuteTime(normalizedTime)) {
    return `${minuteLabel} ${normalizedTime.replace("'", '')}`
  }

  return normalizedTime
}
