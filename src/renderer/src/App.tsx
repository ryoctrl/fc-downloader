/* fc-downloader — app shell: prefs, state, routing, theme */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Creator, DownloadOptions, LibraryPost } from '@shared/types'
import type { AppActions, AppState, Nav, Prefs, ServiceId } from './design/types'
import { AppCtx } from './design/context'
import { LANG } from './design/i18n'
import { FC } from './design/data'
import { toViewPost } from './design/library'
import { bridge } from './bridge'
import { TopBar } from './components/TopBar'
import { Rail } from './components/Rail'
import { ServiceScreen } from './screens/ServiceScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { FavoritesScreen } from './screens/FavoritesScreen'
import { PostDetail } from './screens/PostDetail'
import { SettingsScreen } from './screens/SettingsScreen'

const PREFS_KEY = 'fc_prefs'
const FAVS_KEY = 'fc_favs'

function loadFavs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persistFavs(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]))
  } catch {
    /* ignore */
  }
}

const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  accent: '#2f6df0',
  density: 'comfy',
  viewerView: 'grid',
  lang: 'ja'
}

const EMPTY_OPTIONS: DownloadOptions = {
  creatorIds: [],
  skipExisting: true,
  concurrency: 3,
  includeKinds: ['image', 'video', 'audio', 'file']
}

const ACCENT_HUE: Record<string, number> = {
  '#2f6df0': 256,
  '#6257f0': 285,
  '#0e9aa0': 200,
  '#7a8a99': 240
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function useSystemDark(): boolean {
  const mq = () => (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)
  const [dark, setDark] = useState(() => {
    const m = mq()
    return m ? m.matches : false
  })
  useEffect(() => {
    const m = mq()
    if (!m) return
    const h = (e: MediaQueryListEvent) => setDark(e.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return dark
}

export function App() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadJson(PREFS_KEY, DEFAULT_PREFS))
  const setTweak = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => {
      const next = { ...p, [key]: value }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  const L = LANG[prefs.lang] || LANG.ja

  const [nav, setNav] = useState<Nav>({ screen: 'service', serviceId: 'fantia' })
  // Real login state per service, populated from services:checkAuth.
  const [logins, setLogins] = useState<Record<string, boolean>>({})
  const [creators, setCreators] = useState<Record<string, Creator[]>>({})
  const [creatorsLoading, setCreatorsLoading] = useState<Record<string, boolean>>({})
  const [favs, setFavs] = useState<Set<string>>(loadFavs)
  const [rawPosts, setRawPosts] = useState<LibraryPost[]>([])
  const posts = useMemo(() => rawPosts.map(toViewPost), [rawPosts])
  const [download, setDownload] = useState<AppState['download']>(null)
  const [queued, setQueued] = useState<ServiceId[]>([])
  const optionsRef = useRef<Record<string, DownloadOptions>>({})
  const [concurrency, setConcurrencyState] = useState(3)
  const [skipDupDefault, setSkipDupDefault] = useState(true)
  const [saveDir, setSaveDir] = useState('~/fc-downloads')
  const sysDark = useSystemDark()

  // Load persisted settings from the main process (no-op without a backend).
  useEffect(() => {
    void bridge.getSettings().then((s) => {
      if (!s) return
      setSaveDir(s.downloadRoot)
      setConcurrencyState(s.defaultConcurrency)
    })
  }, [])

  // Load the real downloaded posts from the metadata ledger on startup.
  useEffect(() => {
    void bridge.listPosts().then(setRawPosts)
  }, [])

  // Mirror the backend download queue: switch the active run as it advances.
  useEffect(() => {
    const off = bridge.onDownloadQueue(({ active, queued: q }) => {
      setQueued(q)
      if (!active) return
      setDownload((d) =>
        !d || d.svcId !== active || d.done
          ? { svcId: active, options: optionsRef.current[active] ?? d?.options ?? EMPTY_OPTIONS, startedAt: Date.now(), done: false }
          : d
      )
    })
    return off
  }, [])

  // Determine real login state per service on startup, and react to changes
  // pushed from the main process (services:authChanged).
  useEffect(() => {
    for (const svc of FC.SERVICES) {
      void bridge.checkAuth(svc.id).then((ok) => setLogins((s) => ({ ...s, [svc.id]: ok })))
    }
    const off = bridge.onAuthChanged(({ serviceId, loggedIn }) =>
      setLogins((s) => ({ ...s, [serviceId]: loggedIn }))
    )
    return off
  }, [])

  const setConcurrency = (n: number): void => {
    setConcurrencyState(n)
    void bridge.updateSettings({ defaultConcurrency: n })
  }
  const resolvedTheme = prefs.theme === 'system' ? (sysDark ? 'dark' : 'light') : prefs.theme

  const reloadPosts = (): void => {
    void bridge.listPosts().then(setRawPosts)
  }

  const actions: AppActions = {
    toggleFav: (key) =>
      setFavs((s) => {
        const n = new Set(s)
        if (n.has(key)) n.delete(key)
        else n.add(key)
        persistFavs(n)
        return n
      }),
    reloadPosts,
    recheckAuth: (id) => {
      void bridge.checkAuth(id).then((ok) => setLogins((s) => ({ ...s, [id]: ok })))
    },
    clearSession: (id) => {
      void bridge.clearSession(id).then(() => {
        setLogins((s) => ({ ...s, [id]: false }))
        setCreators((s) => ({ ...s, [id]: [] }))
      })
    },
    loadCreators: (id, force) => {
      if (!force && creators[id]) return // cached
      if (creatorsLoading[id]) return // already loading
      setCreatorsLoading((s) => ({ ...s, [id]: true }))
      void bridge
        .listCreators(id)
        .then((list) => setCreators((s) => ({ ...s, [id]: list })))
        .finally(() => setCreatorsLoading((s) => ({ ...s, [id]: false })))
    },
    startDownload: (svc, options) => {
      optionsRef.current[svc.id] = options
      // Optimistic: show it now if nothing is running; otherwise it queues.
      setDownload((d) =>
        !d || d.done ? { svcId: svc.id, options, startedAt: Date.now(), done: false } : d
      )
      void bridge.startDownload(svc.id, options)
      setNav({ screen: 'progress' })
    },
    retryDownload: () => {
      if (!download) return
      void bridge.startDownload(download.svcId, download.options)
    },
    markDownloadDone: () => {
      setDownload((d) => (d && !d.done ? { ...d, done: true } : d))
      reloadPosts() // newly downloaded content appears in the library
    },
    cancelDownload: () => {
      void bridge.cancelDownload()
      const svcId = download?.svcId ?? 'fantia'
      setDownload(null)
      setQueued([])
      setNav({ screen: 'service', serviceId: svcId })
    },
    setConcurrency,
    pickSaveDir: () => {
      void bridge.pickDownloadRoot().then((dir) => {
        if (!dir) return
        setSaveDir(dir)
        void bridge.updateSettings({ downloadRoot: dir })
      })
    },
    toggleSkipDefault: () => setSkipDupDefault((v) => !v)
  }

  const app = {
    t: prefs,
    setTweak,
    L,
    lang: prefs.lang,
    nav,
    go: setNav,
    state: {
      logins,
      creators,
      creatorsLoading,
      favs,
      download,
      queued,
      saveDir,
      concurrency,
      skipDupDefault
    },
    actions,
    posts
  }

  const rootStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--accent': prefs.accent,
        '--accent-tint': `color-mix(in srgb, ${prefs.accent} 13%, transparent)`,
        '--accent-shadow': `color-mix(in srgb, ${prefs.accent} 34%, transparent)`,
        '--accent-hue': ACCENT_HUE[prefs.accent] || 256
      }) as CSSProperties,
    [prefs.accent]
  )

  const screen = () => {
    switch (nav.screen) {
      case 'service':
        // Key by serviceId so switching services remounts the <webview> with
        // the correct `persist:<id>` partition (the partition attribute is
        // immutable after attach — without this, all logins share one session).
        return <ServiceScreen key={nav.serviceId} serviceId={nav.serviceId} />
      case 'progress':
        return <ProgressScreen />
      case 'library':
        return <LibraryScreen />
      case 'favorites':
        return <FavoritesScreen />
      case 'post':
        return <PostDetail />
      case 'settings':
        return <SettingsScreen />
      default:
        return <ServiceScreen serviceId="fantia" />
    }
  }

  return (
    <AppCtx.Provider value={app}>
      <div
        data-theme={resolvedTheme}
        style={{
          ...rootStyle,
          colorScheme: resolvedTheme,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          color: 'var(--text)',
          overflow: 'hidden'
        }}
      >
        <TopBar />
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Rail />
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {screen()}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  )
}
