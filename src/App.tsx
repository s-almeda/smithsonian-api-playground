import { useCallback, useEffect, useState } from 'react'
import { callApi, SIGNUP_URL, useApiKey, type ApiRequest, type Lang } from './api'
import { DEFAULT_SEARCH, ItemTab, LangContext, SearchTab, StatsPanel, TermsTab, type ItemQuery, type SearchForm, type SearchQuery } from './tabs'

type Tab = 'search' | 'item' | 'terms'

// shareable links: ?id=edanmdm:... opens that record in the content tab
const linkedId = new URLSearchParams(location.search).get('id')

export default function App() {
  const { key, stored, fromEnv, save } = useApiKey()
  const [tab, setTab] = useState<Tab>(linkedId ? 'item' : 'search')
  const lang = useState<Lang>('curl')
  const run = useCallback((req: ApiRequest) => callApi(req, key), [key])

  const [searchForm, setSearchForm] = useState<SearchForm>(DEFAULT_SEARCH)
  const [searchQuery, setSearchQuery] = useState<SearchQuery | null>(null)
  const [itemInput, setItemInput] = useState(linkedId ?? '')
  const [itemQuery, setItemQuery] = useState<ItemQuery | null>(linkedId ? { id: linkedId, n: 0 } : null)

  // keep ?id= in the address bar in sync with the record being viewed
  useEffect(() => {
    const url = new URL(location.href)
    if (tab === 'item' && itemQuery) url.searchParams.set('id', itemQuery.id)
    else url.searchParams.delete('id')
    history.replaceState(null, '', url)
  }, [tab, itemQuery])

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
              S
              <span className="relative -mx-[0.15em] font-hand text-shm-green">
                ^<span className="absolute bottom-[2.2em] left-1/2 -translate-x-1/2 -rotate-8 font-hand text-[0.6em] font-bold">h</span>
              </span>
              mithsonian Open Access
            </h1>
            <p className="font-hand text-base tracking-[0.12em]">API playground prototype by shm :3</p>
          </div>
          <div className="text-right text-xs text-si-line">
            <input
              type="password"
              className="w-full border border-si-slate bg-si-slate px-2 py-1 text-sm text-si-paper placeholder:text-si-gray"
              defaultValue={stored}
              placeholder={fromEnv ? 'using key from .env' : 'your API key'}
              onBlur={(e) => save(e.target.value)}
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
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
          <TermsTab top={tabs} run={run} onTerm={searchFq} />
        </div>
        <StatsPanel apiKey={key} run={run} onUnit={searchFq} />
      </main>
      </div>
    </LangContext.Provider>
  )
}
