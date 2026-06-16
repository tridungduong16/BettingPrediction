export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  websocketUrl: import.meta.env.VITE_WS_URL ?? '',
  staticsUrl: import.meta.env.VITE_PUBLIC_STATICS_URL ?? '',
  appEnv: import.meta.env.VITE_APP_ENV ?? 'local',
  defaultMatchId: import.meta.env.VITE_MATCH_ID ?? '2026-001-mexico-vs-south-africa',
  livePollingIntervalMs: Number(import.meta.env.VITE_LIVE_POLLING_INTERVAL_MS ?? 10000),
}
