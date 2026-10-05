import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Clipboard, PanelRightClose, PanelRightOpen } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import 'highlight.js/styles/github-dark.css' // token colors for the code snippets
import { SIGNUP_URL, fieldsOf, imageOf, snippet, type ApiRequest, type ApiResult, type EdanRecord, type Lang } from './api'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
const HLJS_LANG: Record<Lang, string> = { curl: 'bash', js: 'javascript', python: 'python' }

export type Run = (req: ApiRequest) => Promise<ApiResult>
const input = 'w-full border border-si-line bg-white px-1.5 py-0.5'

export const LangContext = createContext<[Lang, (l: Lang) => void]>(['curl', () => {}])

// ─── Shared layout: [form + live code | results | raw response] ─────────────

export function Panel({ top, left, center, right }: { top?: ReactNode; left: ReactNode; center: ReactNode; right: ReactNode }) {
  const [rawOpen, setRawOpen] = useState(false)
  return (
    <section className="border border-si-line text-xs">
      {top}
      <div className={`grid md:h-[75vh] transition-[grid-template-columns] duration-300 ease-in-out ${rawOpen ? 'md:grid-cols-[17rem_minmax(0,1fr)_21.75rem]' : 'md:grid-cols-[17rem_minmax(0,1fr)_1.75rem]'}`}>
        <div className="space-y-2 overflow-auto bg-si-mist p-3">{left}</div>
        <div className="space-y-2 overflow-auto bg-si-paper p-3">{center}</div>
        <div className="flex min-h-0 flex-col bg-si-ink text-si-paper md:flex-row">
          {/* toggle: a bar on top on mobile, a tab along the left edge on desktop */}
          <button
            onClick={() => setRawOpen(!rawOpen)}
            title={rawOpen ? 'hide raw JSON' : 'show raw JSON'}
            className="flex shrink-0 cursor-pointer items-center gap-2 bg-si-slate px-3 py-2 text-si-line hover:bg-si-gray hover:text-white md:w-7 md:px-5 md:py-3 md:[writing-mode:vertical-rl]"
          >
            <span className="hidden md:block">{rawOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}</span>
            <span className="md:hidden">{rawOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
            raw JSON response
          </button>
          <div className={`max-h-[60vh] min-w-0 flex-1 space-y-2 overflow-auto p-3 transition-opacity duration-200 md:max-h-none ${rawOpen ? 'opacity-100' : 'pointer-events-none hidden opacity-0 md:block'}`} aria-hidden={!rawOpen}>
            {right}
          </div>
        </div>
      </div>
    </section>
  )
}

// Verbatim from https://edan.si.edu/openaccess/apidocs/ (anchor = #api-{group}-{name}); api_key param omitted
const SORT_DOC = 'The sort of the row response set. Default is relevancy. newest is sort rows by timestamp of record in descending order. updated is sort rows by lastTimeUpdated of record in descending order.'
const DOCS: Record<string, { group: string; path: string; text: string; params: [string, string][] }> = {
  search: {
    group: 'search',
    path: '/search',
    text: 'fetches content based on a query',
    params: [
      ['q', 'the query you would like to issue. Accepts both fielded and non fielded queries. [topic:Gastropoda]. See terms for more field types.'],
      ['start', 'the start row of your query'],
      ['rows', 'size of array to be returned.'],
      ['sort', SORT_DOC],
      ['type', 'The type of row object.. Each type will conform to a published schema.'],
      ['fqs', 'a JsonArray structure list of filter queries filter queries can contain boolean operators AND|OR as well as fielded searches'],
      ['row_group', 'The designated set of row types you are filtering against.. Objects refers to objects, artifacts, specimens. Archives are all archives collection and item records.'],
    ],
  },
  category_search: {
    group: 'search',
    path: '/category/:cat/search',
    text: 'fetches content based on a query against a category. art_design, history_culture or science_technology.',
    params: [
      ['cat', 'the category you are filtering against..'],
      ['q', 'the query you would like to issue. [topic:Gastropoda]. See terms for more field types.'],
      ['start', 'the start row of your query'],
      ['rows', 'size of array to be returned.'],
      ['fqs', 'a JsonArray structure list of filter queries filter queries can contain boolean operators [AND|OR] as well as fielded searches'],
      ['sort', SORT_DOC],
    ],
  },
  content: { group: 'content', path: '/content/:id', text: 'fetches content based on id/url of an object.', params: [['id', 'Row id, url.']] },
  terms: {
    group: 'search',
    path: '/terms/:category',
    text: 'fetches an array of terms based term category',
    params: [
      ['category', 'the term category'],
      ['starts_with', 'the optional string prefix filter.'],
    ],
  },
  stats: { group: 'metrics', path: '/stats', text: 'fetches stats for CC0 objects/media', params: [] },
}

function DocNote({ name }: { name: string }) {
  const d = DOCS[name]
  const [open, setOpen] = useState(false)
  // only offer "show more" when the collapsed text is actually cut off
  const body = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    if (!open && body.current) setClipped(body.current.scrollHeight > body.current.clientHeight)
  }, [name, open])
  return (
    <div className="border border-si-line bg-si-paper p-2">
      <div className="flex">
        <code className="font-medium">GET {d.path}</code>
        <a href={`https://edan.si.edu/openaccess/apidocs/#api-${d.group}-${name}`} target="_blank" rel="noreferrer" className="ml-auto text-si-teal underline">
          view in apidocs ↗
        </a>
      </div>
      <div ref={body} className={open ? '' : 'max-h-16 overflow-hidden'}>
        <p className="mt-1">{d.text}</p>
        {d.params.length > 0 && (
          <dl className="mt-1 space-y-1 text-si-gray">
            {d.params.map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-mono text-si-ink">{k}</dt> — <dd className="inline">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {(clipped || open) && (
        <button onClick={() => setOpen(!open)} className="mt-1 cursor-pointer text-si-teal underline">
          {open ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <span className="text-si-gray">{label}</span>
      {children}
    </label>
  )
}

const LANGS: [Lang, string][] = [
  ['curl', 'cURL'],
  ['js', 'JavaScript'],
  ['python', 'Python'],
]

function CodeBox({ req }: { req: ApiRequest }) {
  const [lang, setLang] = useContext(LangContext)
  const code = snippet(lang, req)
  // sliding highlight: measure the selected button, move a blue pill behind it
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pill, setPill] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const measure = () => {
      const b = buttons.current[lang]
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth })
    }
    measure()
    document.fonts.ready.then(measure) // re-measure once web fonts change the label widths
  }, [lang])

  return (
    <div className="text-si-paper">
      {/* folder tabs sit on the panel background, flush on top of the dark code area */}
      <div className="relative flex w-fit rounded-t-md bg-si-slate">
        <span className="absolute inset-y-0 rounded-t-md bg-si-blue transition-all duration-300 ease-out" style={pill} />
        {LANGS.map(([l, label]) => (
          <button
            key={l}
            ref={(el) => {
              buttons.current[l] = el
            }}
            onClick={() => setLang(l)}
            className={`relative cursor-pointer py-1 px-2.5 hover:text-si-gold ${lang === l ? 'text-white' : 'text-si-line'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative bg-si-ink p-2">
        <Copy text={code} className="absolute top-2 right-2" />
        <pre
          className="pr-7 font-mono text-[11px] whitespace-pre-wrap text-si-mist wrap-anywhere"
          dangerouslySetInnerHTML={{ __html: hljs.highlight(code, { language: HLJS_LANG[lang] }).value }}
        />
      </div>
    </div>
  )
}

function Raw({ result, loading }: { result: ApiResult | null; loading?: boolean }) {
  const body = result ? (result.json === undefined ? result.text : JSON.stringify(result.json, null, 2)) : ''
  return (
    <>
      <div className="flex gap-2">
        <span className={result?.error ? 'text-red-400' : 'text-si-gray'}>{loading ? 'loading…' : result && `${result.status} · ${result.ms} ms`}</span>
        <Copy text={body} />
      </div>
      <pre className="overflow-auto font-mono text-[11px] text-si-mist">{body.length > 200_000 ? body.slice(0, 200_000) + '\n… (truncated, copy for full)' : body}</pre>
    </>
  )
}

function Copy({ text, className = 'ml-auto' }: { text: string; className?: string }) {
  // toast is `fixed` at the button's screen position so scroll containers can't clip it; key replays the animation
  const [toast, setToast] = useState<{ x: number; y: number; key: number } | null>(null)
  if (!text) return null
  return (
    <button
      title="copy"
      className={`${className} cursor-pointer rounded-full bg-si-blue p-1 text-white hover:bg-si-gold hover:text-si-ink active:bg-shm-green active:text-si-ink`}
      onClick={(e) => {
        navigator.clipboard.writeText(text)
        const b = e.currentTarget.getBoundingClientRect()
        setToast({ x: b.left + b.width / 2, y: b.top, key: Date.now() })
      }}
    >
      <Clipboard size={14} />
      {toast && (
        <span
          key={toast.key}
          style={{ left: toast.x, top: toast.y }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+4px)] animate-float-up bg-si-gold px-1.5 py-0.5 whitespace-nowrap text-si-ink"
        >
          copied to clipboard
        </span>
      )}
    </button>
  )
}

/** Runs the request each time `query` changes; ignores stale responses. */
function useResult(query: unknown, req: () => ApiRequest | null, run: Run) {
  const [result, setResult] = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const r = query ? req() : null
    if (!r) return
    let live = true
    setLoading(true)
    run(r).then((res) => {
      if (live) {
        setResult(res)
        setLoading(false)
      }
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  return { result, loading, response: (result?.json as { response?: any } | undefined)?.response }
}

/** "don't have an API key? [get your API key here]" — used in the header and on key errors */
export function GetKey({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      don't have an API key?
      <a
        href={SIGNUP_URL}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-si-blue px-2.5 py-0.5 text-white hover:bg-si-gold hover:text-si-ink active:bg-shm-green active:text-si-ink"
      >
        get your API key here
      </a>
    </div>
  )
}

function Status({ loading, result }: { loading?: boolean; result: ApiResult | null }) {
  if (loading) return <p className="text-si-gray">Loading…</p>
  if (!result?.error) return null
  return (
    <>
      {result.keyError && <GetKey className="border border-si-line bg-white p-2" />}
      <p className="text-red-700">{result.error}</p>
    </>
  )
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchForm {
  q: string
  category: string
  type: string
  sort: string
  rows: string
  fqs: string
}
export const DEFAULT_SEARCH: SearchForm = { q: '', category: '', type: '', sort: '', rows: '24', fqs: '["media_usage:CC0","online_media_type:Images"]' }
export type SearchQuery = { form: SearchForm; page: number }

function fqsError(fqs: string): string | null {
  if (!fqs.trim()) return null
  try {
    if (Array.isArray(JSON.parse(fqs))) return null
  } catch {
    /* fall through */
  }
  return 'Must be a JSON array, otherwise the API silently ignores it.'
}

function searchRequest({ form, page }: SearchQuery): ApiRequest {
  const rows = Number(form.rows) || 10
  return {
    path: form.category ? `/category/${form.category}/search` : '/search',
    params: {
      q: form.q.trim() || '*',
      start: page > 1 ? String((page - 1) * rows) : '',
      rows: form.rows,
      sort: form.sort,
      type: form.type,
      fqs: form.fqs.trim(),
    },
  }
}

export function SearchTab(props: {
  top: ReactNode
  form: SearchForm
  setForm: (f: SearchForm) => void
  query: SearchQuery | null
  setQuery: (q: SearchQuery) => void
  run: Run
  onOpen: (id: string) => void
}) {
  const { top, form, setForm, query, setQuery, run, onOpen } = props
  const { result, loading, response } = useResult(query, () => query && searchRequest(query), run)
  const rows: EdanRecord[] = (query && response?.rows) || []
  const lastPage = query ? Math.max(1, Math.ceil((response?.rowCount ?? 0) / (Number(query.form.rows) || 10))) : 1
  const set = (k: keyof SearchForm) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const err = fqsError(form.fqs)
  // live code: reflects the form as you edit (keeps the current page until the form changes)
  const draft = searchRequest({ form, page: query?.form === form ? query.page : 1 })

  return (
    <Panel
      top={top}
      left={
        <>
          <DocNote name={form.category ? 'category_search' : 'search'} />
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              setQuery({ form, page: 1 })
            }}
          >
            <Field label="q">
              <input className={input} value={form.q} onChange={set('q')} placeholder="ex: dogs (empty = *)" />
            </Field>
            <Field label="category">
              <select className={input} value={form.category} onChange={set('category')}>
                <option value="">(none)</option>
                <option>art_design</option>
                <option>history_culture</option>
                <option>science_technology</option>
              </select>
            </Field>
            <Field label="type">
              <select className={input} value={form.type} onChange={set('type')}>
                <option value="">edanmdm</option>
                <option>ead_collection</option>
                <option>ead_component</option>
                <option>all</option>
              </select>
            </Field>
            <Field label="sort">
              <select className={input} value={form.sort} onChange={set('sort')}>
                <option value="">relevancy</option>
                <option>newest</option>
                <option>updated</option>
                <option>random</option>
                <option>id</option>
              </select>
            </Field>
            <Field label="rows">
              <input className={input} type="number" min={1} max={1000} value={form.rows} onChange={set('rows')} />
            </Field>
            <Field label="fqs">
              <textarea className={`${input} font-mono`} rows={2} value={form.fqs} onChange={set('fqs')} placeholder='["unit_code:NASM"]' />
            </Field>
            {err && <p className="text-red-700">{err}</p>}
            <button className="bg-si-blue px-3 py-1 text-sm text-white hover:bg-si-teal">search</button>
          </form>
          <CodeBox req={draft} />
        </>
      }
      center={
        <>
          {!query && <p className="text-si-gray">search on the left; results will appear here!</p>}
          {query && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-si-gray">
              {response && `${(response.rowCount ?? 0).toLocaleString()} results`}
              {response && lastPage > 1 && <Pages page={query.page} last={lastPage} onPage={(page) => setQuery({ ...query, page })} />}
            </div>
          )}
          <Status loading={loading} result={result} />
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-40' : ''}`}>
            {rows.map((r) => {
              const src = imageOf(r, 300)
              return (
                <button key={r.id} onClick={() => onOpen(r.url)} className="border border-si-line bg-white text-left hover:border-si-blue">
                  <div className="flex aspect-square items-center justify-center bg-si-mist text-si-gray">
                    {src ? <img src={src} alt="" loading="lazy" className="size-full object-contain" /> : 'no image'}
                  </div>
                  <p className="line-clamp-2 p-1.5">{r.title}</p>
                </button>
              )
            })}
          </div>
        </>
      }
      right={<Raw result={result} loading={loading} />}
    />
  )
}

function Pages({ page, last, onPage }: { page: number; last: number; onPage: (p: number) => void }) {
  const nums = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, last])].filter((n) => n >= 1 && n <= last)
  const btn = 'px-1.5 hover:bg-white disabled:opacity-30'
  return (
    <div className="flex flex-wrap gap-0.5 text-si-ink">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ prev
      </button>
      {nums.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && n - nums[i - 1] > 1 && '…'}
          <button onClick={() => onPage(n)} className={n === page ? 'bg-si-ink px-1.5 text-white' : btn}>
            {n.toLocaleString()}
          </button>
        </Fragment>
      ))}
      <button className={btn} disabled={page >= last} onClick={() => onPage(page + 1)}>
        next ›
      </button>
    </div>
  )
}

// ─── Item ────────────────────────────────────────────────────────────────────

export type ItemQuery = { id: string; n: number }

const EXAMPLE_ID = 'edanmdm:chndm_1949-17-1'


export function ItemTab(props: { top: ReactNode; input: string; setInput: (s: string) => void; query: ItemQuery | null; setQuery: (q: ItemQuery) => void; run: Run }) {
  const { top, input: value, setInput, query, setQuery, run } = props
  const { result, loading, response } = useResult(query, () => query && { path: `/content/${query.id}`, params: {} }, run)
  const r = response?.id ? (response as EdanRecord) : null
  const src = r && imageOf(r, 800)
  // 3D models link to Smithsonian's Voyager viewer, which can be embedded
  const model3d = r?.content.descriptiveNonRepeating?.online_media?.media?.find((m) => m.type === '3d_voyager')?.content
  const link = r?.content.descriptiveNonRepeating?.record_link

  return (
    <Panel
      top={top}
      left={
        <>
          <DocNote name="content" />
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              setQuery({ id: value.trim() || EXAMPLE_ID, n: Date.now() })
            }}
          >
            <Field label="id / url">
              <input className={input} value={value} onChange={(e) => setInput(e.target.value)} placeholder="edanmdm:chndm_1949-17-1" />
            </Field>
            <button className="bg-si-blue px-3 py-1 text-sm text-white hover:bg-si-teal">fetch</button>
          </form>
          <CodeBox req={{ path: `/content/${value.trim() || ':id'}`, params: {} }} />
        </>
      }
      center={
        <>
          <Status loading={loading} result={result} />
          {!query && <p className="text-si-gray">Click a search result or enter an id.</p>}
          {r && !loading && (
            <>
              <h2 className="font-serif text-2xl">{r.title}</h2>
              <p className="text-si-gray">
                {r.unitCode} · {r.type}
                {link && (
                  <>
                    {' · '}
                    <a href={link} target="_blank" rel="noreferrer" className="text-si-teal underline">
                      record page
                    </a>
                  </>
                )}
              </p>
              {model3d ? (
                <iframe src={model3d} title="3D model" allowFullScreen className="aspect-video w-full bg-si-ink" />
              ) : (
                src && <img src={src} alt="" className="max-h-[50vh] bg-white" />
              )}
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3">
                {fieldsOf(r).map((f, i) => (
                  <Fragment key={i}>
                    <dt className="text-si-gray">{f.label}</dt>
                    <dd>{f.content}</dd>
                  </Fragment>
                ))}
              </dl>
            </>
          )}
        </>
      }
      right={<Raw result={result} loading={loading} />}
    />
  )
}

// ─── Terms ───────────────────────────────────────────────────────────────────

export type TermsQuery = { category: string; startsWith: string }

export function TermsTab(props: { top: ReactNode; query: TermsQuery | null; setQuery: (q: TermsQuery) => void; run: Run; onTerm: (fq: string) => void }) {
  const { top, query, setQuery, run, onTerm } = props
  const [category, setCategory] = useState(query?.category ?? 'unit_code')
  const [startsWith, setStartsWith] = useState(query?.startsWith ?? '')
  // back/forward can change the query from outside: mirror it into the form
  useEffect(() => {
    if (query) {
      setCategory(query.category)
      setStartsWith(query.startsWith)
    }
  }, [query])
  const req = (c: string, s: string): ApiRequest => ({ path: `/terms/${c}`, params: { starts_with: s } })
  const { result, loading, response } = useResult(query, () => query && req(query.category, query.startsWith), run)
  const terms: string[] = response?.terms ?? []

  return (
    <Panel
      top={top}
      left={
        <>
          <DocNote name="terms" />
          <form
            className="grid gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              setQuery({ category, startsWith: startsWith.trim() })
            }}
          >
            <Field label="category">
              <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                {['unit_code', 'online_media_type', 'data_source', 'date', 'culture', 'place', 'topic', 'object_type'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="starts_with">
              <input className={input} value={startsWith} onChange={(e) => setStartsWith(e.target.value)} placeholder="case-sensitive" />
            </Field>
            {(category === 'place' || category === 'topic') && !startsWith && <p className="text-si-gray">Tip: use starts_with, full list is ~4 MB.</p>}
            <button className="bg-si-blue px-3 py-1 text-sm text-white hover:bg-si-teal">get terms</button>
          </form>
          <CodeBox req={req(category, startsWith.trim())} />
        </>
      }
      center={
        <>
          <Status loading={loading} result={result} />
          {!query && <p className="text-si-gray">Click a term to search with it.</p>}
          {query && !loading && terms.length > 0 && (
            <>
              <p className="text-si-gray">
                {terms.length.toLocaleString()} terms{terms.length > 500 && ', showing first 500'}
              </p>
              <div className="flex flex-wrap gap-1">
                {terms.slice(0, 500).map((t) => (
                  <button key={t} onClick={() => onTerm(`${query.category}:"${t}"`)} className="border border-si-line bg-white px-1.5 hover:border-si-blue">
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      }
      right={<Raw result={result} loading={loading} />}
    />
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────

interface Unit {
  unit: string
  data_source: string
  total_objects: number
  metrics: { CC0_records: number; CC0_records_with_CC0_media: number }
}

const STATS_REQ: ApiRequest = { path: '/stats', params: {} }

export function StatsPanel({ apiKey, run, onUnit }: { apiKey: string; run: Run; onUnit: (fq: string) => void }) {
  const [result, setResult] = useState<ApiResult | null>(null)
  useEffect(() => {
    if (apiKey) run(STATS_REQ).then(setResult)
  }, [apiKey, run])
  const stats = (result?.json as { response?: { time: string; total_objects: number; metrics: { CC0_records: number }; units: Unit[] } })?.response
  const max = Math.max(1, ...(stats?.units ?? []).map((u) => u.metrics.CC0_records))

  return (
    <Panel
      top={
        <h2 className="flex border-b border-si-line bg-si-mist px-3 pt-1.5 text-sm">
          <span className="border-b-2 border-si-blue pb-1">metrics</span>
        </h2>
      }
      left={
        <>
          <DocNote name="stats" />
          <CodeBox req={STATS_REQ} />
        </>
      }
      center={
        <>
          <Status result={result} />
          {stats && (
            <>
              <p className="text-si-gray">
                {stats.time} · {stats.total_objects.toLocaleString()} objects, {stats.metrics.CC0_records.toLocaleString()} CC0. Bars = CC0 records per
                unit; click to search.
              </p>
              <div>
                {stats.units.map((u) => (
                  <button
                    key={u.unit}
                    onClick={() => onUnit(`unit_code:${u.unit}`)}
                    title={`${u.data_source}\nTotal: ${u.total_objects.toLocaleString()}\nCC0 with media: ${u.metrics.CC0_records_with_CC0_media.toLocaleString()}`}
                    className="grid w-full grid-cols-[7rem_1fr_5.5rem] items-center gap-2 text-left hover:bg-si-mist"
                  >
                    {u.unit}
                    <span className="h-2.5 bg-si-blue" style={{ width: `${(u.metrics.CC0_records / max) * 100}%` }} />
                    <span className="text-right text-si-gray tabular-nums">{u.metrics.CC0_records.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      }
      right={<Raw result={result} />}
    />
  )
}
