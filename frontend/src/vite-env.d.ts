/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
  readonly VITE_PUBLIC_STATICS_URL?: string
  readonly VITE_APP_ENV?: string
  readonly VITE_LIVE_DEBUG_LOGS?: string
  readonly VITE_MATCH_ID?: string
  readonly VITE_LIVE_POLLING_INTERVAL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
