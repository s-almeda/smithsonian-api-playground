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
  shared?: boolean // came from a share link's snapshot, not from the API
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

const KEY_WARNING = 'This is your actual personal API key! you should not share it (or, by extension, this block of code) widely'

/** `apiKey` = the key the user typed into the header; when set it's written into the code (with a warning comment). */
export function snippet(lang: Lang, req: ApiRequest, apiKey = ''): string {
  const base = API_BASE + req.path
  const params = Object.entries(req.params).filter(([, v]) => v)
  const key = apiKey || 'YOUR_API_KEY'
  if (lang === 'curl') {
    // bash can't have a comment between continued lines, so the warning goes above the command
    const lines = [`curl -G '${base}'`, ...[...params, ['api_key', key]].map(([k, v]) => `  --data-urlencode '${k}=${v.replace(/'/g, `'\\''`)}'`)]
    return (apiKey ? `# ${KEY_WARNING}\n` : '') + lines.join(' \\\n')
  }
  if (lang === 'js') {
    return `const params = new URLSearchParams({
${params.map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}
${apiKey ? `  // ${KEY_WARNING}\n` : ''}  api_key: ${JSON.stringify(key)},
});
const res = await fetch("${base}?" + params);
const data = await res.json();
console.log(data);`
  }
  return `import requests

params = {
${params.map(([k, v]) => `    "${k}": ${JSON.stringify(v)},`).join('\n')}
${apiKey ? `    # ${KEY_WARNING}\n` : ''}    "api_key": ${JSON.stringify(key)},
}
data = requests.get("${base}", params=params).json()
print(data)`
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

// ─── Share links: a trimmed copy of the record, compressed into the URL hash, so opening it needs no API call/key ───
//   ?id=edanmdm:...#s=<deflate-raw + base64url>   (the hash never reaches any server)

function trimRecord(r: EdanRecord): EdanRecord {
  const d = r.content.descriptiveNonRepeating
  return {
    id: r.id,
    url: r.url,
    title: r.title,
    unitCode: r.unitCode,
    type: r.type,
    content: {
      descriptiveNonRepeating: d && {
        data_source: d.data_source,
        record_link: d.record_link,
        online_media: d.online_media && { media: d.online_media.media?.map(({ type, content, thumbnail }) => ({ type, content, thumbnail })) },
      },
      indexedStructured: r.content.indexedStructured?.online_media_type && { online_media_type: r.content.indexedStructured.online_media_type },
      freetext: r.content.freetext,
    },
  }
}

async function pack(text: string): Promise<string> {
  const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function unpack(packed: string): Promise<string> {
  const bytes = Uint8Array.from(atob(packed.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
}

export async function shareUrl(r: EdanRecord): Promise<string> {
  return `${location.origin}${location.pathname}?${new URLSearchParams({ id: r.url })}#s=${await pack(JSON.stringify(trimRecord(r)))}`
}

/** Builds a result from a share link's snapshot instead of calling the API. */
export async function snapshotResult(packed: string, req: ApiRequest): Promise<ApiResult> {
  try {
    const text = await unpack(packed)
    return { request: req, status: 200, ms: 0, text, json: { response: JSON.parse(text) }, shared: true }
  } catch {
    return { request: req, status: 0, ms: 0, text: '', json: undefined, error: 'This share link is damaged or incomplete.', shared: true }
  }
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
