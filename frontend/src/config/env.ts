const defaultLivePollingIntervalMs = 5 * 60 * 1000

function booleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function numericEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  websocketUrl: import.meta.env.VITE_WS_URL ?? '',
  staticsUrl: import.meta.env.VITE_PUBLIC_STATICS_URL ?? '',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'local',
  defaultMatchId: import.meta.env.VITE_MATCH_ID ?? '2026-001-mexico-vs-south-africa',
  liveDebugLogs: booleanEnv(
    import.meta.env.VITE_LIVE_DEBUG_LOGS,
    import.meta.env.VITE_APP_ENV !== 'production',
  ),
  livePollingIntervalMs: numericEnv(
    import.meta.env.VITE_LIVE_POLLING_INTERVAL_MS,
    defaultLivePollingIntervalMs,
  ),
}
