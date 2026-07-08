/* fc-downloader — app shell: prefs, state, routing, theme */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type {
  Creator,
  DownloadOptions,
  DownloadProgress,
  LibraryPost,
  PostFileKind,
  UpdateInfo
} from '@shared/types'
import type {
  AppActions,
  AppState,
  DesignService,
  DownloadPrefs,
  Nav,
  Prefs,
  ScheduleConfig,
  ServiceId,
  TreeNode
} from './design/types'
import { AppCtx } from './design/context'
import { LANG } from './design/i18n'
import { FC } from './design/data'
import { Icon } from './design/icons'
import { toViewPost } from './design/library'
import { allLoginsSettled, dayKey, isScheduleDue, minutesOf } from './design/schedule'
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
const SCHEDULE_KEY = 'fc_schedule'
const SCHEDULE_LASTRUN_KEY = 'fc_schedule_lastrun'
const CREATORS_CACHE_KEY = 'fc_creators_cache'
const NEW_CACHE_KEY = 'fc_new_cache'
/** Cached creator lists older than this are refreshed in the background on open
 *  (the cache is still shown instantly meanwhile). ci-en/Fantia enumeration is
 *  slow + rate-limited, so we avoid re-fetching on every quick service switch. */
const CREATORS_TTL_MS = 10 * 60 * 1000

/** Persisted per-service creator list + when it was last fetched. */
interface CreatorsCacheEntry {
  list: Creator[]
  at: number
}
type CreatorsCache = Record<string, CreatorsCacheEntry>

/** Persisted per-service "has new posts" creator ids + when last computed. */
interface NewCacheEntry {
  ids: string[]
  at: number
}
type NewCache = Record<string, NewCacheEntry>

const DEFAULT_SCHEDULE: ScheduleConfig = { enabled: false, time: '03:00' }

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

  // Navigation history (a stack + cursor) so mouse back/forward and the in-app
  // back button can return to the previous view.
  const [navState, setNavState] = useState<{ stack: Nav[]; i: number }>({
    stack: [{ screen: 'service', serviceId: 'fantia' }],
    i: 0
  })
  const nav = navState.stack[navState.i]
  // Library view, kept at app level so returning to it (rail button / back)
  // restores the selected node + expanded tree instead of resetting to "all".
  const [libNode, setLibNode] = useState<TreeNode>({ kind: 'all' })
  const [libExpanded, setLibExpanded] = useState<string[]>([])
  // Real login state per service, populated from services:checkAuth.
  const [logins, setLogins] = useState<Record<string, boolean>>({})
  // Services whose session was detected as expired (were logged in, now not) —
  // surfaced as a re-login prompt. Cleared on re-login or explicit logout.
  const [reloginNeeded, setReloginNeeded] = useState<Set<ServiceId>>(new Set())
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const loginsRef = useRef(logins)
  loginsRef.current = logins
  // Creator lists are cached to localStorage so they show instantly on launch
  // (the enumeration itself takes tens of seconds for ci-en/Fantia). The cache
  // is shown immediately and refreshed in the background when stale.
  const creatorsCache0 = useRef<CreatorsCache>(loadJson<CreatorsCache>(CREATORS_CACHE_KEY, {}))
  const [creators, setCreators] = useState<Record<string, Creator[]>>(() => {
    const out: Record<string, Creator[]> = {}
    for (const [k, v] of Object.entries(creatorsCache0.current)) if (v?.list) out[k] = v.list
    return out
  })
  const creatorsFetchedAt = useRef<Record<string, number>>(
    Object.fromEntries(
      Object.entries(creatorsCache0.current).map(([k, v]) => [k, v?.at ?? 0])
    )
  )
  const [creatorsLoading, setCreatorsLoading] = useState<Record<string, boolean>>({})
  const creatorsLoadingRef = useRef<Record<string, boolean>>({})
  // Per-service creator ids with a downloadable post newer than what's on disk
  // ("new posts" indicator), cached like the creator list.
  const newCache0 = useRef<NewCache>(loadJson<NewCache>(NEW_CACHE_KEY, {}))
  const [newByService, setNewByService] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(newCache0.current)) if (v?.ids) out[k] = v.ids
    return out
  })
  const newFetchedAt = useRef<Record<string, number>>(
    Object.fromEntries(Object.entries(newCache0.current).map(([k, v]) => [k, v?.at ?? 0]))
  )
  const newLoadingRef = useRef<Record<string, boolean>>({})
  const [favs, setFavs] = useState<Set<string>>(loadFavs)
  const [rawPosts, setRawPosts] = useState<LibraryPost[]>([])
  const posts = useMemo(() => rawPosts.map(toViewPost), [rawPosts])
  const [download, setDownload] = useState<AppState['download']>(null)
  const [lastProgress, setLastProgress] = useState<DownloadProgress | null>(null)
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
  const enabledRef = useRef(enabledServices)
  enabledRef.current = enabledServices
  const [schedule, setScheduleState] = useState<ScheduleConfig>(() =>
    loadJson(SCHEDULE_KEY, DEFAULT_SCHEDULE)
  )
  const scheduleRef = useRef(schedule)
  scheduleRef.current = schedule
  const lastRunRef = useRef<string>(localStorage.getItem(SCHEDULE_LASTRUN_KEY) ?? '')
  const bulkRef = useRef<() => boolean>(() => false)
  const [saveDir, setSaveDir] = useState('~/fc-downloads')
  const [launchAtStartup, setLaunchAtStartupState] = useState(false)
  const [lastSync, setLastSync] = useState<Record<string, string>>({})
  const sysDark = useSystemDark()

  // Load persisted settings from the main process (no-op without a backend).
  useEffect(() => {
    void bridge.getSettings().then((s) => {
      if (!s) return
      setSaveDir(s.downloadRoot)
      setConcurrencyState(s.defaultConcurrency)
      setLastSync(s.lastSync ?? {})
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

  // Check GitHub for a newer release on startup (best-effort; banner only).
  useEffect(() => {
    void bridge.checkUpdate().then((info) => {
      if (info?.available) setUpdate(info)
    })
  }, [])

  // Reflect the actual OS launch-at-login state (the OS login item is the
  // source of truth — not persisted in our settings).
  useEffect(() => {
    void bridge.getStartupEnabled().then(setLaunchAtStartupState)
  }, [])

  // If the active service screen is for a now-disabled service, move away from
  // it (to the first enabled service, else the library).
  useEffect(() => {
    if (nav.screen !== 'service') return
    if (enabledServices[nav.serviceId] === false) {
      const firstEnabled = FC.SERVICES.find((s) => enabledServices[s.id] !== false)
      go(firstEnabled ? { screen: 'service', serviceId: firstEnabled.id } : { screen: 'library' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, enabledServices])

  // Mouse back/forward (X1/X2) buttons drive history navigation.
  useEffect(() => {
    const onMouseUp = (e: MouseEvent): void => {
      if (e.button === 3) {
        e.preventDefault()
        goBack()
      } else if (e.button === 4) {
        e.preventDefault()
        goForward()
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // App-level download lifecycle (so it works regardless of which screen is
  // shown): keep the latest progress snapshot, mark the run done on completion,
  // and refresh the library in near-real-time (throttled to once every 2s) so
  // newly downloaded posts appear. The progress screen has its own (richer)
  // live subscription while mounted, but it misses events when unmounted —
  // hence this. listPosts reads the live in-memory ledger.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const throttledReload = (): void => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void bridge.listPosts().then(setRawPosts)
      }, 2000)
    }
    const offProgress = bridge.onDownloadProgress((p) => {
      setLastProgress(p)
      throttledReload()
    })
    const offDone = bridge.onDownloadDone((p) => {
      setLastProgress(p)
      setDownload((d) => (d && !d.done ? { ...d, done: true } : d))
      void bridge.listPosts().then(setRawPosts)
      // The run just recorded its "last synced" time; refresh it for the library.
      void bridge.getSettings().then((s) => s && setLastSync(s.lastSync ?? {}))
      // Downloaded posts are no longer "new" — force the indicator to recompute
      // the next time a service screen opens (cheap: one feed walk per revisit).
      newFetchedAt.current = {}
    })
    return () => {
      offProgress()
      offDone()
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
    const off = bridge.onAuthChanged(({ serviceId, loggedIn }) => {
      setLogins((s) => ({ ...s, [serviceId]: loggedIn }))
      // Re-login clears the prompt. (Expiry is only ever flagged by the passive
      // focus re-check below, never here — so an explicit logout won't prompt.)
      if (loggedIn) {
        setReloginNeeded((r) => {
          if (!r.has(serviceId)) return r
          const n = new Set(r)
          n.delete(serviceId)
          return n
        })
      }
    })
    return off
  }, [])

  // Logout detection (event-driven, no polling): when the window regains focus
  // after being away, re-check the services that were logged in. If a session
  // silently expired, flag it so the user can re-login.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onFocus = (): void => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        for (const svc of FC.SERVICES) {
          if (!loginsRef.current[svc.id]) continue // only verify previously logged-in
          void bridge.checkAuth(svc.id).then((ok) => {
            setLogins((s) => ({ ...s, [svc.id]: ok }))
            if (!ok) setReloginNeeded((r) => new Set(r).add(svc.id))
          })
        }
      }, 600)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Daily auto-download scheduler (runs while the app is open). Fires at most
  // once per day, catching up if the app was opened after the scheduled time.
  const runScheduledIfDue = useCallback((): void => {
    if (!isScheduleDue(scheduleRef.current, lastRunRef.current, new Date())) return
    // Wait until EVERY enabled service's login state has settled (defined as
    // true/false, not still-loading `undefined`). Auth checks resolve at
    // different speeds — Fantia's is a fast API call, FANBOX needs two, ci-en
    // scrapes HTML — so without this gate the first one to resolve would fire
    // the daily run and consume the day's slot before the slower services'
    // logins are known, downloading only that service (e.g. only Fantia).
    if (
      !allLoginsSettled(
        FC.SERVICES.map((s) => s.id),
        enabledRef.current,
        loginsRef.current
      )
    )
      return
    // Only consume today's slot once a run actually started — at launch the
    // login state is still loading, so an early catch-up would otherwise mark
    // the day done having downloaded nothing.
    if (!bulkRef.current()) return
    lastRunRef.current = dayKey(new Date())
    try {
      localStorage.setItem(SCHEDULE_LASTRUN_KEY, lastRunRef.current)
    } catch {
      /* ignore */
    }
  }, [])

  // A 1-minute clock for live firing while the app stays open.
  useEffect(() => {
    const interval = setInterval(runScheduledIfDue, 60_000)
    return () => clearInterval(interval)
  }, [runScheduledIfDue])

  // Re-evaluate as soon as login / enabled / schedule state settles, so a
  // launch catch-up fires the moment auth is known (not up to a minute later,
  // and not skipped because auth was still loading on the first tick).
  useEffect(() => {
    runScheduledIfDue()
  }, [logins, enabledServices, schedule, runScheduledIfDue])

  const setConcurrency = (n: number): void => {
    setConcurrencyState(n)
    void bridge.updateSettings({ defaultConcurrency: n })
  }
  const dismissRelogin = (id: ServiceId): void =>
    setReloginNeeded((r) => {
      const n = new Set(r)
      n.delete(id)
      return n
    })
  const resolvedTheme = prefs.theme === 'system' ? (sysDark ? 'dark' : 'light') : prefs.theme

  // Navigating to a service screen mounts a <webview>, whose attach un-snaps the
  // window on Windows. Capture the bounds first so main can restore them.
  const go = (n: Nav): void => {
    if (n.screen === 'service') void bridge.pinWindowBounds()
    setNavState((s) => ({ stack: [...s.stack.slice(0, s.i + 1), n], i: s.i + 1 }))
  }
  const goBack = (): void =>
    setNavState((s) => {
      if (s.i <= 0) return s
      if (s.stack[s.i - 1].screen === 'service') void bridge.pinWindowBounds()
      return { stack: s.stack, i: s.i - 1 }
    })
  const goForward = (): void =>
    setNavState((s) => {
      if (s.i >= s.stack.length - 1) return s
      if (s.stack[s.i + 1].screen === 'service') void bridge.pinWindowBounds()
      return { stack: s.stack, i: s.i + 1 }
    })

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
    setDownload((d) => {
      if (!d || d.done) {
        setLastProgress(null) // fresh run — drop the previous snapshot
        return { svcId: svc.id, options, startedAt: Date.now(), done: false }
      }
      return d
    })
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
        // Explicit logout: never prompt to re-login for it.
        setReloginNeeded((r) => {
          if (!r.has(id)) return r
          const n = new Set(r)
          n.delete(id)
          return n
        })
      })
    },
    loadCreators: (id, force) => {
      // Ref guard (not the state) so two synchronous callers in the same tick —
      // e.g. the startup prefetch and the service screen's mount effect — can't
      // both start a fetch before the loading state applies.
      if (creatorsLoadingRef.current[id]) return
      // The cached list (if any) is already shown from state. Only hit the
      // network when explicitly forced, when there's no cache, or when the
      // cache has gone stale — otherwise a quick service switch is instant.
      const fresh = (creatorsFetchedAt.current[id] ?? 0) > Date.now() - CREATORS_TTL_MS
      if (!force && creators[id] && fresh) return
      creatorsLoadingRef.current[id] = true
      setCreatorsLoading((s) => ({ ...s, [id]: true }))
      void bridge
        .listCreators(id)
        .then((list) => {
          setCreators((s) => ({ ...s, [id]: list }))
          const at = Date.now()
          creatorsFetchedAt.current[id] = at
          try {
            const cache = loadJson<CreatorsCache>(CREATORS_CACHE_KEY, {})
            cache[id] = { list, at }
            localStorage.setItem(CREATORS_CACHE_KEY, JSON.stringify(cache))
          } catch {
            /* cache is best-effort; a write failure just means a slow next load */
          }
        })
        .finally(() => {
          creatorsLoadingRef.current[id] = false
          setCreatorsLoading((s) => ({ ...s, [id]: false }))
        })
    },
    loadNew: (id, force) => {
      if (newLoadingRef.current[id]) return
      const fresh = (newFetchedAt.current[id] ?? 0) > Date.now() - CREATORS_TTL_MS
      if (!force && newByService[id] && fresh) return
      newLoadingRef.current[id] = true
      void bridge
        .checkNewCreators(id)
        .then((ids) => {
          setNewByService((s) => ({ ...s, [id]: ids }))
          const at = Date.now()
          newFetchedAt.current[id] = at
          try {
            const cache = loadJson<NewCache>(NEW_CACHE_KEY, {})
            cache[id] = { ids, at }
            localStorage.setItem(NEW_CACHE_KEY, JSON.stringify(cache))
          } catch {
            /* best-effort cache */
          }
        })
        .finally(() => {
          newLoadingRef.current[id] = false
        })
    },
    startDownload: (svc, options) => {
      doStartDownload(svc, options)
      go({ screen: 'progress' })
    },
    startBulkDownload: () => {
      let started = false
      for (const svc of FC.SERVICES) {
        // Read login state from the ref so a scheduled/catch-up run sees the
        // latest auth (the closure's `logins` is stale right after launch).
        if (enabledServices[svc.id] === false || !loginsRef.current[svc.id]) continue
        const opts = buildDownloadOptions(svc.id)
        if (!opts) continue
        doStartDownload(svc, opts)
        started = true
      }
      if (started) go({ screen: 'progress' })
      return started
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
      }),
    setSchedule: (patch) =>
      setScheduleState((p) => {
        const next = { ...p, ...patch }
        try {
          localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        // Enabling after today's time already passed: mark today as run so it
        // doesn't fire immediately (starts at the next occurrence).
        if (patch.enabled === true) {
          const now = new Date()
          const t = dayKey(now)
          if (now.getHours() * 60 + now.getMinutes() >= minutesOf(next.time) && lastRunRef.current !== t) {
            lastRunRef.current = t
            try {
              localStorage.setItem(SCHEDULE_LASTRUN_KEY, t)
            } catch {
              /* ignore */
            }
          }
        }
        return next
      }),
    setLaunchAtStartup: (enabled) => {
      // Optimistic flip; reconcile with whatever the OS actually reports.
      setLaunchAtStartupState(enabled)
      void bridge.setStartupEnabled(enabled).then(setLaunchAtStartupState)
    },
    setLibNode,
    setLibExpanded
  }
  bulkRef.current = actions.startBulkDownload

  // Prefetch every enabled + logged-in service's creator list + "new" indicator
  // in the background at launch (and as each login resolves), so the data is
  // fresh before the user first opens a service — instead of only fetching on
  // that first navigation. Both calls are TTL-guarded, so this never forces a
  // redundant refetch; logins resolve at different speeds, so the per-service
  // fetches naturally stagger (gentle on ci-en's rate limit).
  useEffect(() => {
    for (const svc of FC.SERVICES) {
      if (enabledServices[svc.id] === false || !logins[svc.id]) continue
      actions.loadCreators(svc.id)
      actions.loadNew(svc.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logins, enabledServices])

  const app = {
    t: prefs,
    setTweak,
    L,
    lang: prefs.lang,
    nav,
    go,
    goBack,
    goForward,
    state: {
      logins,
      creators,
      creatorsLoading,
      newByService,
      favs,
      download,
      lastProgress,
      queued,
      saveDir,
      concurrency,
      downloadPrefs,
      creatorSel,
      enabledServices,
      schedule,
      launchAtStartup,
      lastSync,
      libNode,
      libExpanded
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
            {update && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  padding: '8px 16px',
                  background: 'var(--accent-tint)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 12.5
                }}
              >
                <Icon name="download" size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>
                  {L.updateAvailable} v{update.latest}
                </span>
                <span style={{ color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                  (v{update.current} → v{update.latest})
                </span>
                <button
                  onClick={() => bridge.openExternal(update.url)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 99,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit'
                  }}
                >
                  {L.openReleasePage}
                </button>
                <button
                  onClick={() => setUpdate(null)}
                  title={L.dismiss}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}
            {reloginNeeded.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  padding: '8px 16px',
                  background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 12.5
                }}
              >
                <Icon name="bell" size={15} style={{ color: 'var(--warn)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{L.sessionExpired}</span>
                {[...reloginNeeded].map((id) => (
                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => go({ screen: 'service', serviceId: id })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 99,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'var(--warn)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'inherit'
                      }}
                    >
                      {FC.serviceById(id).name} · {L.relogin}
                    </button>
                    <button
                      onClick={() => dismissRelogin(id)}
                      title={L.dismiss}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        display: 'flex'
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {screen()}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  )
}
