import { useState } from 'react'

export const API_BASE = 'https://api.si.edu/openaccess/api/v1.0'
export const SIGNUP_URL = 'https://edan.si.edu/openaccess/signup/form'

export type Params = Record<string, string>
export interface ApiRequest {
  path: string
  params: Params
}
export interface ApiResult {
  request: ApiRequest
  status: number
  ms: number
  text: string
  json: unknown // undefined when the body isn't JSON
  error?: string
}

export function buildUrl(req: ApiRequest, apiKey: string): string {
  const url = new URL(API_BASE + req.path)
  for (const [k, v] of Object.entries(req.params)) if (v) url.searchParams.set(k, v)
  url.searchParams.set('api_key', apiKey)
  return url.toString()
}

export async function callApi(req: ApiRequest, apiKey: string): Promise<ApiResult> {
  const t0 = performance.now()
  let status = 0
  let text = ''
  try {
    const res = await fetch(buildUrl(req, apiKey))
    status = res.status
    text = await res.text()
  } catch (e) {
    text = String(e)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON (e.g. firewall HTML page) */
  }
  const j = json as { error?: { message?: string }; response?: { error?: string } } | undefined
  const error = j?.error?.message ?? j?.response?.error ?? (status === 200 ? undefined : `HTTP ${status || 'network error'}`)
  return { request: req, status, ms: Math.round(performance.now() - t0), text, json, error }
}

// ─── Code snippets ───────────────────────────────────────────────────────────

export type Lang = 'curl' | 'js' | 'python'

export function snippet(lang: Lang, req: ApiRequest): string {
  const base = API_BASE + req.path
  const params = [...Object.entries(req.params).filter(([, v]) => v), ['api_key', 'YOUR_API_KEY']]
  if (lang === 'curl') {
    return [`curl -G '${base}'`, ...params.map(([k, v]) => `  --data-urlencode '${k}=${v.replace(/'/g, `'\\''`)}'`)].join(' \\\n')
  }
  if (lang === 'js') {
    return `const params = new URLSearchParams({
${params.map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}
});
const res = await fetch("${base}?" + params);
const data = await res.json();`
  }
  return `import requests

params = {
${params.map(([k, v]) => `    "${k}": ${JSON.stringify(v)},`).join('\n')}
}
data = requests.get("${base}", params=params).json()`
}

// ─── Records (see docs/smithsonian-api.md → "Record") ────────────────────────

export interface EdanRecord {
  id: string
  url: string
  title: string
  unitCode: string
  type: string
  content: {
    descriptiveNonRepeating?: {
      data_source?: string
      record_link?: string
      online_media?: { media?: { type: string; content?: string; thumbnail?: string }[] }
    }
    freetext?: Record<string, { label: string; content: string }[]>
  }
}

/** First CC0 image (IDS URLs resize with a `/N` suffix) or 3D thumbnail. */
export function imageOf(r: EdanRecord, size: number): string | undefined {
  const media = r.content.descriptiveNonRepeating?.online_media?.media ?? []
  const img = media.find((m) => m.type === 'Images' && m.content)
  if (img?.content) return img.content.includes('/deliveryService/id/') ? `${img.content}/${size}` : img.content
  return media.find((m) => m.thumbnail)?.thumbnail
}

export function fieldsOf(r: EdanRecord): { label: string; content: string }[] {
  return Object.values(r.content.freetext ?? {}).flat()
}

// ─── API key: browser (localStorage) overrides VITE_SI_API_KEY from .env ─────

const STORAGE_KEY = 'si-playground:api-key'
const ENV_KEY = (import.meta.env.VITE_SI_API_KEY as string | undefined) ?? ''

export function useApiKey() {
  const [stored, setStored] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const save = (k: string) => {
    setStored(k.trim())
    try {
      localStorage.setItem(STORAGE_KEY, k.trim())
    } catch {
      /* storage unavailable */
    }
  }
  return { key: stored || ENV_KEY, stored, fromEnv: !stored && !!ENV_KEY, save }
}
