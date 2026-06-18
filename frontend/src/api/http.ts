import { env } from '@/config/env'

type QueryValue = boolean | number | string | null | undefined

interface RequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, QueryValue>
}

export class HttpError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.payload = payload
  }
}

function trimSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

export function buildApiUrl(path: string, query?: Record<string, QueryValue>) {
  const baseUrl = trimSlashes(env.apiUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${baseUrl}${normalizedPath}`, window.location.origin)

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path, options.query), {
    ...options,
    credentials: options.credentials ?? 'include',
    headers: {
      Accept: 'application/json',
      ...options.headers,
    },
  })
  const payload = await parseResponse(response)

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText
    throw new HttpError(detail || 'Yêu cầu thất bại', response.status, payload)
  }

  return payload as T
}
