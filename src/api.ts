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
  keyError?: boolean // api.data.gov rejected the key (API_KEY_MISSING / API_KEY_INVALID / ...)
}

export function buildUrl(req: ApiRequest, apiKey: string): string {
  const url = new URL(API_BASE + req.path)
  for (const [k, v] of Object.entries(req.params)) if (v) url.searchParams.set(k, v)
  url.searchParams.set('api_key', apiKey)
  return url.toString()
}

/** Calls the API directly with `apiKey`, or — for invite-link visitors — through the /api/si proxy, which adds the owner's key server-side. */
export async function callApi(req: ApiRequest, apiKey: string, invite = ''): Promise<ApiResult> {
  const t0 = performance.now()
  let status = 0
  let text = ''
  try {
    const res = invite
      ? await fetch(`/api/si?${new URLSearchParams({ path: req.path, ...Object.fromEntries(Object.entries(req.params).filter(([, v]) => v)) })}`, {
          headers: { 'x-invite-token': invite },
        })
      : await fetch(buildUrl(req, apiKey))
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
  const j = json as { error?: { code?: string; message?: string }; response?: { error?: string } } | undefined
  const error = j?.error?.message ?? j?.response?.error ?? (status === 200 ? undefined : `HTTP ${status || 'network error'}`)
  const keyError = !!j?.error?.code?.startsWith('API_KEY') || j?.error?.code === 'INVITE_INVALID'
  return { request: req, status, ms: Math.round(performance.now() - t0), text, json, error, keyError }
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
    indexedStructured?: { online_media_type?: string[] }
    freetext?: Record<string, { label: string; content: string }[]>
  }
}

/** Titles sometimes contain HTML (e.g. "<I>Home Movie #19</I>"): strip tags and decode entities for display. */
export function cleanTitle(title: string): string {
  return new DOMParser().parseFromString(title, 'text/html').body.textContent ?? title
}

/** Media the record is tagged with but that the API withheld (not CC0, so `online_media` is missing). */
export function withheldMedia(r: EdanRecord): string | undefined {
  if (r.content.descriptiveNonRepeating?.online_media?.media?.length) return undefined
  const types = r.content.indexedStructured?.online_media_type ?? []
  if (types.includes('Video recordings')) return 'video'
  if (types.includes('Sound recordings')) return 'audio'
  if (types.includes('Images')) return 'images'
  return undefined
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

// ─── API key: own key (localStorage) > invite link (proxy) > VITE_SI_API_KEY from .env ─────

const STORAGE_KEY = 'si-playground:api-key'
const INVITE_STORAGE_KEY = 'si-playground:invite'
const ENV_KEY = (import.meta.env.VITE_SI_API_KEY as string | undefined) ?? ''

// ?invite=<token> → remember it in this browser and tidy it out of the address bar (runs once, before the app reads the URL)
{
  const url = new URL(location.href)
  const token = url.searchParams.get('invite')
  if (token) {
    try {
      localStorage.setItem(INVITE_STORAGE_KEY, token)
    } catch {
      /* storage unavailable */
    }
    url.searchParams.delete('invite')
    history.replaceState(null, '', url)
  }
}

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
  const [inviteToken, setInviteToken] = useState(() => {
    try {
      return localStorage.getItem(INVITE_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const forgetInvite = () => {
    setInviteToken('')
    try {
      localStorage.removeItem(INVITE_STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
  }
  const invite = stored ? '' : inviteToken // your own key always wins
  return { key: stored || (invite ? '' : ENV_KEY), invite, stored, fromEnv: !stored && !invite && !!ENV_KEY, save, forgetInvite }
}
