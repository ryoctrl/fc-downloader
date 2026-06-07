/* fc-downloader — app shell: prefs, state, routing, theme */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Creator, DownloadOptions, LibraryPost, PostFileKind } from '@shared/types'
import type {
  AppActions,
  AppState,
  DesignService,
  DownloadPrefs,
  Nav,
  Prefs,
  ServiceId
} from './design/types'
import { AppCtx } from './design/context'
import { LANG } from './design/i18n'
import { FC } from './design/data'
import { toViewPost } from './design/library'
import { bridge } from './bridge'
import { Rail } from './components/Rail'
import { ServiceScreen } from './screens/ServiceScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { FavoritesScreen } from './screens/FavoritesScreen'
import { PostDetail } from './screens/PostDetail'
import { SettingsScreen } from './screens/SettingsScreen'

const PREFS_KEY = 'fc_prefs'
const FAVS_KEY = 'fc_favs'
const DL_PREFS_KEY = 'fc_dl_prefs'
const CREATOR_SEL_KEY = 'fc_creator_sel'
const ENABLED_KEY = 'fc_enabled_services'

const DEFAULT_DL_PREFS: DownloadPrefs = { image: true, video: true, file: true, skipDup: true }

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
  const [downloadPrefs, setDownloadPrefsState] = useState<DownloadPrefs>(() =>
    loadJson(DL_PREFS_KEY, DEFAULT_DL_PREFS)
  )
  const [creatorSel, setCreatorSelState] = useState<Record<string, string[]>>(() =>
    loadJson(CREATOR_SEL_KEY, {})
  )
  const [enabledServices, setEnabledServicesState] = useState<Record<string, boolean>>(() =>
    loadJson(ENABLED_KEY, {})
  )
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

  // Load the real downloaded posts from the metadata ledger on startup, then
  // best-effort backfill avatars for creators downloaded before the avatar
  // feature existed (needs the persisted login session; no-op otherwise).
  useEffect(() => {
    void bridge.listPosts().then((posts) => {
      setRawPosts(posts)
      if (posts.some((p) => !p.creatorIconUrl)) {
        void bridge.backfillAvatars().then((n) => {
          if (n > 0) void bridge.listPosts().then(setRawPosts)
        })
      }
    })
  }, [])

  // If the active service screen is for a now-disabled service, move away from
  // it (to the first enabled service, else the library).
  useEffect(() => {
    if (nav.screen !== 'service') return
    if (enabledServices[nav.serviceId] === false) {
      const firstEnabled = FC.SERVICES.find((s) => enabledServices[s.id] !== false)
      setNav(firstEnabled ? { screen: 'service', serviceId: firstEnabled.id } : { screen: 'library' })
    }
  }, [nav, enabledServices])

  // While a download is running, refresh the library in near-real-time (throttled
  // to once every 2s) so newly downloaded posts appear without waiting for the
  // whole run to finish. listPosts reads the live in-memory ledger.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const off = bridge.onDownloadProgress(() => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void bridge.listPosts().then(setRawPosts)
      }, 2000)
    })
    return () => {
      off()
      if (timer) clearTimeout(timer)
    }
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

  // Navigating to a service screen mounts a <webview>, whose attach un-snaps the
  // window on Windows. Capture the bounds first so main can restore them.
  const go = (n: Nav): void => {
    if (n.screen === 'service') void bridge.pinWindowBounds()
    setNav(n)
  }

  const reloadPosts = (): void => {
    void bridge.listPosts().then(setRawPosts)
  }

  // Build download options for a service from its saved settings. Returns null
  // when nothing would download (no file kinds, or an explicitly empty creator
  // selection). An absent creator selection means "all" (creatorIds: []).
  const buildDownloadOptions = (svcId: ServiceId): DownloadOptions | null => {
    const includeKinds: PostFileKind[] = []
    if (downloadPrefs.image) includeKinds.push('image')
    if (downloadPrefs.video) includeKinds.push('video')
    if (downloadPrefs.file) includeKinds.push('file', 'audio')
    if (includeKinds.length === 0) return null
    const saved = creatorSel[svcId]
    if (saved && saved.length === 0) return null
    return { creatorIds: saved ?? [], skipExisting: downloadPrefs.skipDup, concurrency, includeKinds }
  }

  // Enqueue a single service's run (main-process queue serializes services).
  const doStartDownload = (svc: DesignService, options: DownloadOptions): void => {
    optionsRef.current[svc.id] = options
    // Optimistic: show it now if nothing is running; otherwise it queues.
    setDownload((d) =>
      !d || d.done ? { svcId: svc.id, options, startedAt: Date.now(), done: false } : d
    )
    void bridge.startDownload(svc.id, options)
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
      doStartDownload(svc, options)
      go({ screen: 'progress' })
    },
    startBulkDownload: () => {
      let started = false
      for (const svc of FC.SERVICES) {
        if (enabledServices[svc.id] === false || !logins[svc.id]) continue
        const opts = buildDownloadOptions(svc.id)
        if (!opts) continue
        doStartDownload(svc, opts)
        started = true
      }
      if (started) go({ screen: 'progress' })
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
      go({ screen: 'service', serviceId: svcId })
    },
    setConcurrency,
    pickSaveDir: () => {
      void bridge.pickDownloadRoot().then((dir) => {
        if (!dir) return
        setSaveDir(dir)
        void bridge.updateSettings({ downloadRoot: dir })
      })
    },
    setDownloadPrefs: (patch) =>
      setDownloadPrefsState((p) => {
        const next = { ...p, ...patch }
        try {
          localStorage.setItem(DL_PREFS_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      }),
    setCreatorSel: (serviceId, ids) =>
      setCreatorSelState((s) => {
        const next = { ...s, [serviceId]: ids }
        try {
          localStorage.setItem(CREATOR_SEL_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      }),
    setServiceEnabled: (serviceId, enabled) =>
      setEnabledServicesState((s) => {
        const next = { ...s, [serviceId]: enabled }
        try {
          localStorage.setItem(ENABLED_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
  }

  const app = {
    t: prefs,
    setTweak,
    L,
    lang: prefs.lang,
    nav,
    go,
    state: {
      logins,
      creators,
      creatorsLoading,
      favs,
      download,
      queued,
      saveDir,
      concurrency,
      downloadPrefs,
      creatorSel,
      enabledServices
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
