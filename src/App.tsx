import { useCallback, useEffect, useRef, useState } from 'react'
import { callApi, useApiKey, type ApiRequest, type Lang } from './api'
import { DEFAULT_SEARCH, GetKey, ItemTab, LangContext, SearchTab, StatsPanel, TermsTab, type ItemQuery, type SearchForm, type SearchQuery, type TermsQuery } from './tabs'

type Tab = 'search' | 'item' | 'terms'

// ─── URL ↔ state: every search / page / record / tab gets its own URL, so links are shareable and Back works
//   ?q=moon&sort=newest&page=3      search (only non-default fields are written)
//   ?id=edanmdm:nmah_1119490         content by id
//   ?tab=terms&category=place&starts_with=Pho
type UrlState = { tab: Tab; search: SearchQuery | null; item: ItemQuery | null; terms: TermsQuery | null }
const SEARCH_FIELDS = Object.keys(DEFAULT_SEARCH) as (keyof SearchForm)[]

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search)
  const none = { search: null, item: null, terms: null }
  const id = p.get('id')
  if (id) return { ...none, tab: 'item', item: { id, n: 0 } }
  if (p.get('tab') === 'item') return { ...none, tab: 'item' }
  if (p.get('tab') === 'terms') {
    const category = p.get('category')
    return { ...none, tab: 'terms', terms: category ? { category, startsWith: p.get('starts_with') ?? '' } : null }
  }
  if (!p.has('q')) return { ...none, tab: 'search' }
  const form = { ...DEFAULT_SEARCH }
  for (const k of SEARCH_FIELDS) form[k] = p.get(k) ?? form[k]
  return { ...none, tab: 'search', search: { form, page: Number(p.get('page')) || 1 } }
}

function writeUrl({ tab, search, item, terms }: UrlState): string {
  const p = new URLSearchParams()
  if (tab === 'item') {
    if (item) p.set('id', item.id)
    else p.set('tab', 'item')
  } else if (tab === 'terms') {
    p.set('tab', 'terms')
    if (terms) p.set('category', terms.category)
    if (terms?.startsWith) p.set('starts_with', terms.startsWith)
  } else if (search) {
    for (const k of SEARCH_FIELDS) if (k === 'q' || search.form[k] !== DEFAULT_SEARCH[k]) p.set(k, search.form[k])
    if (search.page > 1) p.set('page', String(search.page))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

const initial = readUrl()

export default function App() {
  const { key, invite, stored, fromEnv, save, forgetInvite } = useApiKey()
  const [tab, setTab] = useState<Tab>(initial.tab)
  const lang = useState<Lang>('curl')
  const run = useCallback((req: ApiRequest) => callApi(req, key, invite), [key, invite])

  const [searchForm, setSearchForm] = useState<SearchForm>(initial.search?.form ?? DEFAULT_SEARCH)
  const [searchQuery, setSearchQuery] = useState<SearchQuery | null>(initial.search)
  const [itemInput, setItemInput] = useState(initial.item?.id ?? '')
  const [itemQuery, setItemQuery] = useState<ItemQuery | null>(initial.item)
  const [termsQuery, setTermsQuery] = useState<TermsQuery | null>(initial.terms)

  // state → URL: push a history entry whenever what you're looking at changes (typing alone doesn't)
  const firstRun = useRef(true)
  useEffect(() => {
    const next = writeUrl({ tab, search: searchQuery, item: itemQuery, terms: termsQuery })
    if (next === location.search) return
    history[firstRun.current ? 'replaceState' : 'pushState'](null, '', next || location.pathname)
    firstRun.current = false
  }, [tab, searchQuery, itemQuery, termsQuery])

  // URL → state on Back/Forward; keeps the existing query object when unchanged so nothing is refetched
  useEffect(() => {
    const onPop = () => {
      const u = readUrl()
      setTab(u.tab)
      if (u.tab === 'search') {
        const q = u.search && searchQuery && JSON.stringify(u.search) === JSON.stringify(searchQuery) ? searchQuery : u.search
        setSearchQuery(q)
        setSearchForm(q?.form ?? DEFAULT_SEARCH)
      }
      if (u.tab === 'item') {
        if (u.item?.id !== itemQuery?.id) setItemQuery(u.item)
        setItemInput(u.item?.id ?? '')
      }
      if (u.tab === 'terms' && JSON.stringify(u.terms) !== JSON.stringify(termsQuery)) setTermsQuery(u.terms)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [searchQuery, itemQuery, termsQuery])

  const openItem = (id: string) => {
    setItemInput(id)
    setItemQuery({ id, n: Date.now() })
    setTab('item')
  }
  const searchFq = (fq: string) => {
    const form = { ...searchForm, q: '', fqs: JSON.stringify([fq]) }
    setSearchForm(form)
    setSearchQuery({ form, page: 1 })
    setTab('search')
    window.scrollTo(0, 0)
  }

  const tabs = (
    <nav className="flex gap-4 border-b border-si-line bg-si-mist px-3 pt-1.5 text-sm">
      {([['search', 'search'], ['item', 'content by id'], ['terms', 'terms']] as [Tab, string][]).map(([t, label]) => (
        <button key={t} onClick={() => setTab(t)} className={`pb-1 ${tab === t ? 'border-b-2 border-si-blue' : 'text-si-gray'}`}>
          {label}
        </button>
      ))}
    </nav>
  )

  return (
    <LangContext.Provider value={lang}>
      <div className="min-h-screen bg-si-paper text-si-ink">
      <header className="bg-si-ink text-si-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3 px-4 pt-9 pb-3">
          <div>
              <h1 className="font-serif text-[2rem] leading-none">
              <img src="favicon.png" alt="silly little sun" className="mr-1 inline-block h-[0.85em] w-auto align-baseline" />
                S
              <span className="relative -mx-[0.15em] font-hand text-shm-green">
                ^<span className="absolute bottom-[1.9em] left-1/2 -translate-x-1/2 -rotate-8 font-hand text-[0.6em] font-bold">h</span>
              </span>
              mithsonian Open Access
            </h1>
            <p className="font-hand text-slate-400 tracking-[0.12em]">API playground prototype by shm :3</p>
          </div>
          <div className="relative text-right text-xs text-slate-400">
            {/* absolute so it floats above the field without making the header taller */}
            <p className="absolute bottom-full left-0 mb-1 font-hand text-base text-slate-300">enter your API key here</p>
            <input
              type="password"
              className="w-full border border-si-slate bg-si-slate px-2 py-1 text-sm text-si-paper placeholder:text-si-gray disabled:cursor-not-allowed disabled:opacity-60"
              defaultValue={stored}
              placeholder={invite ? "using shm's key" : fromEnv ? 'running locally, using key in .env' : 'your API key'}
              disabled={!!invite}
              onBlur={(e) => save(e.target.value)}
            />
            {invite ? (
              <p className="mt-1.5">
                shm sent you this invite link to let you indirectly use their api key! be nice! ·{' '}
                <button onClick={forgetInvite} className="cursor-pointer underline hover:text-si-gold">
                  log out
                </button>
              </p>
            ) : (
              <GetKey className="mt-1.5 justify-end" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className={tab === 'search' ? '' : 'hidden'}>
          <SearchTab top={tabs} form={searchForm} setForm={setSearchForm} query={searchQuery} setQuery={setSearchQuery} run={run} onOpen={openItem} />
        </div>
        <div className={tab === 'item' ? '' : 'hidden'}>
          <ItemTab top={tabs} input={itemInput} setInput={setItemInput} query={itemQuery} setQuery={setItemQuery} run={run} />
        </div>
        <div className={tab === 'terms' ? '' : 'hidden'}>
          <TermsTab top={tabs} query={termsQuery} setQuery={setTermsQuery} run={run} onTerm={searchFq} />
        </div>
        <StatsPanel apiKey={key || invite} run={run} onUnit={searchFq} />
      </main>
      </div>
    </LangContext.Provider>
  )
}
