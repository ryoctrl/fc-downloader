/* fc-downloader — app shell, i18n, routing, tweaks */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "system",
  "accent": "#2f6df0",
  "density": "comfy",
  "viewerView": "grid",
  "settingsLayout": "right",
  "chrome": "mac",
  "lang": "ja"
}/*EDITMODE-END*/;

const ACCENT_HUE = { "#2f6df0": 256, "#6257f0": 285, "#0e9aa0": 200, "#7a8a99": 240 };

const LANG = {
  ja: {
    appName: 'fc-downloader',
    // rail
    library: 'ライブラリ', favorites: 'お気に入り', settings: '設定',
    // webview / login
    logInToContinue: 'ログインして続行', email: 'メールアドレス', password: 'パスワード',
    logIn: 'ログイン', webviewHint: 'WebView · このサービスのログインページ',
    openInBrowser: 'ブラウザで開く',
    // download settings
    downloadSettings: 'ダウンロード設定', loggedIn: 'ログイン済み', notLoggedIn: '未ログイン',
    scope: '取得対象', allPosts: 'すべての投稿', newOnly: '新着のみ', dateRange: '期間を指定',
    creators: 'クリエイター', selectAll: 'すべて選択', deselectAll: '選択解除',
    fileTypes: 'ファイル種別', images: '画像', videos: '動画', filesType: 'ファイル',
    options: 'オプション', skipDuplicates: '重複をスキップ', skipDupHint: '取得済みの投稿は再取得しない',
    folderByDate: '年月でフォルダ分け', saveLocation: '保存先', change: '変更',
    estimate: '推定', postsUnit: '投稿', filesUnit: 'ファイル', dupSkipped: '件は取得済みのためスキップ',
    startDownload: '一斉ダウンロード開始', loginRequired: 'ログインが必要です',
    // progress
    noActiveDownload: '進行中のダウンロードはありません', downloading: 'ダウンロード中', paused: '一時停止中',
    downloadComplete: 'ダウンロード完了', posts: '投稿', size: 'サイズ', speed: '速度', eta: '残り',
    doneShort: '完了', resume: '再開', pauseBtn: '一時停止', viewInLibrary: 'ライブラリで見る',
    cancel: 'キャンセル', openFolder: 'フォルダを開く', queued: '待機',
    // viewer
    month: '月', search: '検索…', newest: '新しい順', oldest: '古い順',
    allStatus: 'すべて', downloaded: '取得済み', notDownloaded: '未取得', partial: '一部',
    allTypes: '全種別', noResults: '該当する投稿がありません', title: 'タイトル', posted: '投稿日',
    type: '種別', status: '状態',
    // detail
    back: '戻る', prev: '前へ', next: '次へ', favorite: 'お気に入り', favorited: '登録済み',
    downloadThis: 'この投稿をダウンロード', folderPath: '保存パス', tags: 'タグ',
    favSubtitle: 'サービスを横断して好きな投稿を保存', allServices: 'すべて', noFavorites: 'お気に入りはまだありません',
    // settings
    settingsSub: 'アカウント・保存先・アプリの動作', accountsCookies: 'アカウント / Cookie',
    accountsDesc: 'WebView のログイン状態と Cookie をサービスごとに管理します',
    connected: '接続済み', disconnected: '未接続', clearCookies: 'Cookie を削除',
    storage: '保存先 / ストレージ', storageDesc: 'ダウンロードしたファイルの保存場所と使用量',
    browse: '参照', used: '使用中', general: '一般', language: '言語', languageHint: 'UI の表示言語',
    theme: 'テーマ', themeHint: '外観モード', light: 'ライト', dark: 'ダーク', system: 'システム',
    from: '開始', to: '終了', brandLogos: 'ブランドロゴ', brandLogosDesc: '各サービスのロゴ画像を設定（未設定時は頭文字表示）', upload: '画像を選択', remove: '削除',
    concurrency: '同時ダウンロード数', concurrencyHint: '並行して取得するファイル数',
    about: 'このアプリについて', localOnly: 'すべての処理はこの PC 内で完結します',
  },
  en: {
    appName: 'fc-downloader',
    library: 'Library', favorites: 'Favorites', settings: 'Settings',
    logInToContinue: 'Log in to continue', email: 'Email', password: 'Password',
    logIn: 'Log in', webviewHint: 'WebView · service login page', openInBrowser: 'Open in browser',
    downloadSettings: 'Download settings', loggedIn: 'Logged in', notLoggedIn: 'Not logged in',
    scope: 'Scope', allPosts: 'All posts', newOnly: 'New only', dateRange: 'Date range',
    creators: 'Creators', selectAll: 'Select all', deselectAll: 'Clear',
    fileTypes: 'File types', images: 'Images', videos: 'Videos', filesType: 'Files',
    options: 'Options', skipDuplicates: 'Skip duplicates', skipDupHint: "Don't re-fetch downloaded posts",
    folderByDate: 'Folder by date', saveLocation: 'Save location', change: 'Change',
    estimate: 'Estimate', postsUnit: 'posts', filesUnit: 'files', dupSkipped: 'already downloaded, skipped',
    startDownload: 'Start bulk download', loginRequired: 'Login required',
    noActiveDownload: 'No active download', downloading: 'Downloading', paused: 'Paused',
    downloadComplete: 'Download complete', posts: 'Posts', size: 'Size', speed: 'Speed', eta: 'ETA',
    doneShort: 'Done', resume: 'Resume', pauseBtn: 'Pause', viewInLibrary: 'View in library',
    cancel: 'Cancel', openFolder: 'Open folder', queued: 'Queued',
    month: '', search: 'Search…', newest: 'Newest', oldest: 'Oldest',
    allStatus: 'All', downloaded: 'Downloaded', notDownloaded: 'Not yet', partial: 'Partial',
    allTypes: 'All types', noResults: 'No posts found', title: 'Title', posted: 'Posted',
    type: 'Type', status: 'Status',
    back: 'Back', prev: 'Prev', next: 'Next', favorite: 'Favorite', favorited: 'Saved',
    downloadThis: 'Download this post', folderPath: 'Save path', tags: 'Tags',
    favSubtitle: 'Save posts you love across every service', allServices: 'All', noFavorites: 'No favorites yet',
    settingsSub: 'Accounts, storage and app behavior', accountsCookies: 'Accounts / Cookies',
    accountsDesc: 'Manage WebView login state and cookies per service',
    connected: 'Connected', disconnected: 'Disconnected', clearCookies: 'Clear cookies',
    storage: 'Storage', storageDesc: 'Where downloads are saved and disk usage',
    browse: 'Browse', used: 'used', general: 'General', language: 'Language', languageHint: 'UI language',
    theme: 'Theme', themeHint: 'Appearance', light: 'Light', dark: 'Dark', system: 'System',
    from: 'From', to: 'To', brandLogos: 'Brand logos', brandLogosDesc: 'Set a logo image per service (monogram shown if unset)', upload: 'Choose image', remove: 'Remove',
    concurrency: 'Concurrent downloads', concurrencyHint: 'Files fetched in parallel',
    about: 'About', localOnly: 'Everything runs locally on this PC',
  },
};

const SHORT = { fantia: 'Fantia', fanbox: 'FANBOX', patreon: 'Patreon', cien: 'ci-en' };

function useSystemDark() {
  const mq = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  const [dark, setDark] = React.useState(() => { const m = mq(); return m ? m.matches : false; });
  React.useEffect(() => {
    const m = mq(); if (!m) return;
    const h = (e) => setDark(e.matches);
    m.addEventListener ? m.addEventListener('change', h) : m.addListener(h);
    return () => { m.removeEventListener ? m.removeEventListener('change', h) : m.removeListener(h); };
  }, []);
  return dark;
}

const LOGO_KEY = 'fc_brand_logos';

function RailItem({ active, onClick, mark, icon, label, accentColor }) {
  return (
    <button onClick={onClick} title={label} className="fc-rail-item" style={{
      position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '9px 4px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 12,
      color: active ? 'var(--text)' : 'var(--text-3)',
    }}>
      {active && <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3.5, height: 22, borderRadius: 99, background: 'var(--accent)' }} />}
      <div style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 11, background: active && !mark ? 'var(--accent-tint)' : 'transparent', color: active && !mark ? 'var(--accent)' : 'inherit', transition: 'background .15s' }}>
        {mark || <Icon name={icon} size={21} />}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function TopBar({ app }) {
  const L = app.L;
  const mac = app.t.chrome === 'mac';
  const dl = app.state.download;
  const dlActive = dl && !dl.done;
  return (
    <div style={{ height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', WebkitAppRegion: 'drag' }}>
      {mac ? (
        <div style={{ display: 'flex', gap: 8, paddingLeft: 2 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="download" size={15} strokeWidth={2.4} /></div>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', justifyContent: mac ? 'center' : 'flex-start', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.01em' }}>fc-downloader</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {dlActive ? (
          <button onClick={() => app.go({ screen: 'progress' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
            <span className="fc-spin" style={{ width: 12, height: 12, borderRadius: 99, border: '2px solid currentColor', borderTopColor: 'transparent' }} />
            {L.downloading}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'var(--surface-2)', color: 'var(--text-3)', fontSize: 11.5, fontFamily: 'var(--mono)' }}>
            <Icon name="hdd" size={13} />{FC.fmtSize(FC.totals.sizeMB)}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const L = LANG[t.lang] || LANG.ja;

  const [nav, setNav] = React.useState({ screen: 'service', serviceId: 'fantia' });
  const [logins, setLogins] = React.useState({ fantia: true, fanbox: true, patreon: false, cien: false });
  const [favs, setFavs] = React.useState(() => new Set(FC.POSTS.filter((p) => p.fav).map((p) => p.id)));
  const [download, setDownload] = React.useState(null);
  const [concurrency, setConcurrency] = React.useState(3);
  const [skipDupDefault, setSkipDupDefault] = React.useState(true);
  const [brandLogos, setBrandLogos] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(LOGO_KEY) || '{}'); } catch (e) { return {}; }
  });
  const [, setRev] = React.useState(0);
  const saveDir = '~/fc-downloads';
  const sysDark = useSystemDark();
  const resolvedTheme = t.theme === 'system' ? (sysDark ? 'dark' : 'light') : t.theme;

  const persistLogos = (next) => { try { localStorage.setItem(LOGO_KEY, JSON.stringify(next)); } catch (e) {} };

  const actions = {
    toggleFav: (id) => setFavs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    setLogin: (id, v) => setLogins((s) => ({ ...s, [id]: v })),
    startDownload: (svc, plan) => { setDownload({ svcId: svc.id, items: plan.items, dup: plan.dup || 0, done: false, startedAt: Date.now() }); setNav({ screen: 'progress' }); },
    markDownloadDone: () => setDownload((d) => { if (d && !d.done) { d.items.forEach((p) => { p.status = 'done'; }); setRev((r) => r + 1); return { ...d, done: true }; } return d; }),
    cancelDownload: () => { setDownload(null); setNav({ screen: 'service', serviceId: nav.serviceId || 'fantia' }); },
    setConcurrency, toggleSkipDefault: () => setSkipDupDefault((v) => !v),
    setBrandLogo: (id, dataUrl) => setBrandLogos((s) => { const n = { ...s, [id]: dataUrl }; persistLogos(n); return n; }),
    clearBrandLogo: (id) => setBrandLogos((s) => { const n = { ...s }; delete n[id]; persistLogos(n); return n; }),
  };

  const app = {
    t, setTweak, L, lang: t.lang, nav, go: setNav,
    state: { logins, favs, download, saveDir, concurrency, skipDupDefault, brandLogos },
    actions,
  };

  const accentHue = ACCENT_HUE[t.accent] || 256;
  const rootStyle = {
    '--accent': t.accent,
    '--accent-tint': `color-mix(in srgb, ${t.accent} 13%, transparent)`,
    '--accent-shadow': `color-mix(in srgb, ${t.accent} 34%, transparent)`,
    '--accent-hue': accentHue,
  };

  const screen = () => {
    switch (nav.screen) {
      case 'service': return <ServiceScreen serviceId={nav.serviceId} />;
      case 'progress': return <ProgressScreen />;
      case 'library': return <LibraryScreen />;
      case 'favorites': return <FavoritesScreen />;
      case 'post': return <PostDetail />;
      case 'settings': return <SettingsScreen />;
      default: return <ServiceScreen serviceId="fantia" />;
    }
  };

  return (
    <AppCtx.Provider value={app}>
      <div data-theme={resolvedTheme} style={{ ...rootStyle, colorScheme: resolvedTheme, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
        <TopBar app={app} />
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* rail */}
          <div style={{ width: 72, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', padding: '10px 8px', gap: 2, overflow: 'auto' }}>
            {FC.SERVICES.map((svc) => (
              <RailItem key={svc.id} label={SHORT[svc.id]} active={nav.screen === 'service' && nav.serviceId === svc.id}
                        onClick={() => app.go({ screen: 'service', serviceId: svc.id })}
                        mark={<ServiceMark svc={svc} size={34} active={nav.screen === 'service' && nav.serviceId === svc.id} />} />
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
            <RailItem label={L.library} icon="library" active={nav.screen === 'library' || nav.screen === 'post' && nav.from === 'library'} onClick={() => app.go({ screen: 'library' })} />
            <RailItem label={L.favorites} icon="heart" active={nav.screen === 'favorites' || nav.screen === 'post' && nav.from === 'favorites'} onClick={() => app.go({ screen: 'favorites' })} />
            <div style={{ flex: 1 }} />
            <RailItem label={L.settings} icon="gear" active={nav.screen === 'settings'} onClick={() => app.go({ screen: 'settings' })} />
          </div>
          {/* content */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {screen()}
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="表示 / Display" />
        <TweakRadio label="テーマ Theme" value={t.theme} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => setTweak('theme', v)} />
        <TweakColor label="アクセント Accent" value={t.accent} options={['#2f6df0', '#6257f0', '#0e9aa0', '#7a8a99']} onChange={(v) => setTweak('accent', v)} />
        <TweakRadio label="情報密度 Density" value={t.density} options={[{ value: 'comfy', label: '広め' }, { value: 'compact', label: '詰める' }]} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="言語 Language" value={t.lang} options={[{ value: 'ja', label: '日本語' }, { value: 'en', label: 'EN' }]} onChange={(v) => setTweak('lang', v)} />
        <TweakSection label="レイアウト / Layout" />
        <TweakSelect label="DL設定パネル位置" value={t.settingsLayout} options={[{ value: 'right', label: '右サイドパネル' }, { value: 'bottom', label: '下部パネル' }, { value: 'overlay', label: 'オーバーレイ' }]} onChange={(v) => setTweak('settingsLayout', v)} />
        <TweakRadio label="ビューワー View" value={t.viewerView} options={[{ value: 'grid', label: 'グリッド' }, { value: 'list', label: 'リスト' }]} onChange={(v) => setTweak('viewerView', v)} />
        <TweakRadio label="ウィンドウ Chrome" value={t.chrome} options={[{ value: 'mac', label: 'macOS' }, { value: 'plain', label: 'Plain' }]} onChange={(v) => setTweak('chrome', v)} />
      </TweaksPanel>
    </AppCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
