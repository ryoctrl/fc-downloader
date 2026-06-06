/* fc-downloader — Service screen: WebView mock + download settings panel */

function UrlBar({ svc, loggedIn }) {
  const app = useApp();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
      borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', gap: 4, color: 'var(--text-3)' }}>
        <Icon name="arrowL" size={16} /><Icon name="arrowR" size={16} /><Icon name="refresh" size={15} />
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px',
        background: 'var(--surface-2)', borderRadius: 8, fontFamily: 'var(--mono)',
        fontSize: 12, color: 'var(--text-2)',
      }}>
        <Icon name="lock" size={12} style={{ color: 'var(--ok)' }} />
        https://{svc.note}/{loggedIn ? '' : 'login'}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
        color: loggedIn ? 'var(--ok)' : 'var(--text-3)', fontFamily: 'var(--mono)',
        padding: '3px 8px', borderRadius: 99, background: 'var(--surface-2)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: loggedIn ? 'var(--ok)' : 'var(--text-3)' }} />
        {loggedIn ? 'WebView' : 'WebView'}
      </div>
    </div>
  );
}

function WebViewMock({ svc, loggedIn }) {
  const app = useApp();
  const L = app.L;
  if (!loggedIn) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: `oklch(0.96 0.012 ${svc.hue})`, overflow: 'auto' }}>
        <div style={{
          width: 340, background: 'var(--surface)', borderRadius: 16, padding: '34px 30px',
          boxShadow: '0 20px 60px rgba(0,0,0,.12)', border: '1px solid var(--border)', textAlign: 'center',
        }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 18 }}>
            <ServiceMark svc={svc} size={52} active />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{svc.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4, marginBottom: 22 }}>{L.logInToContinue}</div>
          {[L.email, L.password].map((ph, i) => (
            <div key={i} style={{
              textAlign: 'left', marginBottom: 11, padding: '11px 13px', borderRadius: 9,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name={i === 0 ? 'globe' : 'lock'} size={14} />{ph}
            </div>
          ))}
          <div style={{
            marginTop: 6, padding: '11px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
            background: `oklch(0.58 0.15 ${svc.hue})`, color: '#fff', cursor: 'pointer',
          }}>{L.logIn}</div>
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            {L.webviewHint}
          </div>
        </div>
      </div>
    );
  }
  // logged-in mock feed
  const posts = FC.POSTS.filter((p) => p.service === svc.id).slice(0, 9);
  const creators = FC.CREATORS[svc.id] || [];
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)' }}>
      <div style={{ height: 96, background: `linear-gradient(120deg, oklch(0.62 0.13 ${svc.hue}), oklch(0.55 0.15 ${(svc.hue + 30) % 360}))` }} />
      <div style={{ padding: '0 26px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: -26 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, border: '3px solid var(--surface)', background: 'var(--surface)' }}>
            <ServiceMark svc={svc} size={58} active />
          </div>
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{svc.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{creators.length} creators · {posts.length}+ posts</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, margin: '22px 0 30px' }}>
          {posts.map((p) => (
            <div key={p.id} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <Thumb post={p} radius={0} ratio="16 / 10" />
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{p.creatorName} · {p.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── download settings panel ──
function MonthField({ label, value, onChange }) {
  return (
    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</span>
      <input type="month" min="2023-01" max="2026-05" value={value} onChange={(e) => onChange(e.target.value)}
             style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12, outline: 'none' }} />
    </label>
  );
}

function RangePicker({ since, until, setSince, setUntil, L }) {
  return (
    <div style={{ marginTop: 10, padding: '12px 13px', borderRadius: 10, background: 'var(--accent-tint)', border: '1px solid var(--accent)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <MonthField label={L.from} value={since} onChange={setSince} />
        <span style={{ paddingBottom: 9, color: 'var(--text-3)' }}>–</span>
        <MonthField label={L.to} value={until} onChange={setUntil} />
      </div>
    </div>
  );
}

function ScopeRadio({ value, onChange, L }) {
  const opts = [['all', L.allPosts], ['new', L.newOnly], ['range', L.dateRange]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {opts.map(([v, lbl]) => (
        <label key={v} onClick={() => onChange(v)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
          borderRadius: 9, border: '1px solid ' + (value === v ? 'var(--accent)' : 'var(--border)'),
          background: value === v ? 'var(--accent-tint)' : 'transparent',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 99, flexShrink: 0,
            border: '2px solid ' + (value === v ? 'var(--accent)' : 'var(--text-3)'),
            display: 'grid', placeItems: 'center',
          }}>
            {value === v && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--accent)' }} />}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{lbl}</span>
        </label>
      ))}
    </div>
  );
}

function Check({ on, onClick, label, count }) {
  return (
    <label onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', cursor: 'pointer',
    }}>
      <span style={{
        width: 17, height: 17, borderRadius: 5, flexShrink: 0,
        border: '1.5px solid ' + (on ? 'var(--accent)' : 'var(--text-3)'),
        background: on ? 'var(--accent)' : 'transparent', color: '#fff',
        display: 'grid', placeItems: 'center',
      }}>{on && <Icon name="check" size={12} strokeWidth={2.6} />}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{label}</span>
      {count != null && <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{count}</span>}
    </label>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 9px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{children}</div>
      {action}
    </div>
  );
}

function SettingsPanel({ svc, loggedIn, compact }) {
  const app = useApp();
  const L = app.L;
  const allPosts = React.useMemo(() => FC.POSTS.filter((p) => p.service === svc.id), [svc.id]);
  const creators = FC.CREATORS[svc.id] || [];
  const [scope, setScope] = React.useState('new');
  const [types, setTypes] = React.useState({ image: true, video: true, file: true });
  const [sel, setSel] = React.useState(() => new Set(creators.map((c) => c.id)));
  const [skipDup, setSkipDup] = React.useState(true);
  const [foldering, setFoldering] = React.useState(true);
  const [since, setSince] = React.useState('2025-01');
  const [until, setUntil] = React.useState('2026-05');

  React.useEffect(() => { setSel(new Set(creators.map((c) => c.id))); }, [svc.id]);

  const plan = React.useMemo(() => {
    let ps = allPosts.filter((p) => sel.has(p.creator) && types[p.type]);
    if (scope === 'new') ps = ps.filter((p) => p.status !== 'done');
    if (scope === 'range') ps = ps.filter((p) => { const ym = `${p.year}-${String(p.month).padStart(2, '0')}`; return ym >= since && ym <= until; });
    const dup = skipDup ? ps.filter((p) => p.status === 'done').length : 0;
    const toGet = skipDup ? ps.filter((p) => p.status !== 'done') : ps;
    return {
      total: ps.length, dup,
      posts: toGet.length,
      files: toGet.reduce((s, p) => s + p.files, 0),
      sizeMB: toGet.reduce((s, p) => s + p.sizeMB, 0),
      items: toGet,
    };
  }, [allPosts, sel, types, scope, skipDup, since, until]);

  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = sel.size === creators.length;

  const typeRow = [['image', L.images, 'image'], ['video', L.videos, 'play'], ['file', L.filesType, 'file']];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: compact ? '14px 16px 10px' : '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <ServiceMark svc={svc} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>{L.downloadSettings}</div>
            <div style={{ fontSize: 11.5, color: loggedIn ? 'var(--ok)' : 'var(--warn)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: loggedIn ? 'var(--ok)' : 'var(--warn)' }} />
              {loggedIn ? L.loggedIn : L.notLoggedIn} · {svc.name}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: compact ? '14px 16px' : '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <SectionLabel>{L.scope}</SectionLabel>
          <ScopeRadio value={scope} onChange={setScope} L={L} />
          {scope === 'range' && <RangePicker since={since} until={until} setSince={setSince} setUntil={setUntil} L={L} />}
        </div>

        <div>
          <SectionLabel action={
            <span onClick={() => setSel(allSel ? new Set() : new Set(creators.map((c) => c.id)))}
                  style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
              {allSel ? L.deselectAll : L.selectAll}
            </span>}>{L.creators} · {sel.size}/{creators.length}</SectionLabel>
          <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '4px 12px' }}>
            {creators.map((c) => (
              <Check key={c.id} on={sel.has(c.id)} onClick={() => toggleSel(c.id)}
                     label={c.name} count={allPosts.filter((p) => p.creator === c.id).length} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>{L.fileTypes}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {typeRow.map(([k, lbl, ic]) => (
              <div key={k} onClick={() => setTypes((t) => ({ ...t, [k]: !t[k] }))}
                   style={{
                     flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                     padding: '11px 6px', borderRadius: 10, cursor: 'pointer',
                     border: '1px solid ' + (types[k] ? 'var(--accent)' : 'var(--border)'),
                     background: types[k] ? 'var(--accent-tint)' : 'transparent',
                     color: types[k] ? 'var(--accent)' : 'var(--text-3)',
                   }}>
                <Icon name={ic} size={18} />
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>{L.options}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <OptToggle on={skipDup} onClick={() => setSkipDup(!skipDup)} icon="refresh" label={L.skipDuplicates} hint={L.skipDupHint} />
            <OptToggle on={foldering} onClick={() => setFoldering(!foldering)} icon="folder" label={L.folderByDate} hint="service / user / YYYY / MM / id" />
          </div>
        </div>

        <div>
          <SectionLabel action={<span style={{ fontSize: 11.5, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>{L.change}</span>}>{L.saveLocation}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 9, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-2)' }}>
            <Icon name="hdd" size={14} style={{ color: 'var(--text-3)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.state.saveDir}/{svc.id}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: compact ? '12px 16px' : '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11, fontSize: 12 }}>
          <span style={{ color: 'var(--text-3)' }}>{L.estimate}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 600 }}>
            {plan.posts} {L.postsUnit} · {plan.files} {L.filesUnit} · {FC.fmtSize(plan.sizeMB)}
          </span>
        </div>
        {skipDup && plan.dup > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="check" size={12} style={{ color: 'var(--ok)' }} />{plan.dup} {L.dupSkipped}
          </div>
        )}
        <button onClick={() => loggedIn && plan.posts > 0 && app.actions.startDownload(svc, plan)}
                disabled={!loggedIn || plan.posts === 0}
                style={{
                  width: '100%', padding: '13px', borderRadius: 11, border: 'none', cursor: loggedIn && plan.posts ? 'pointer' : 'not-allowed',
                  fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  background: loggedIn && plan.posts ? 'var(--accent)' : 'var(--surface-2)',
                  color: loggedIn && plan.posts ? '#fff' : 'var(--text-3)',
                  boxShadow: loggedIn && plan.posts ? '0 4px 16px var(--accent-shadow)' : 'none',
                }}>
          <Icon name="download" size={18} strokeWidth={2.2} />
          {loggedIn ? L.startDownload : L.loginRequired}
        </button>
      </div>
    </div>
  );
}

function OptToggle({ on, onClick, icon, label, hint }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 4px', cursor: 'pointer' }}>
      <Icon name={icon} size={16} style={{ color: on ? 'var(--accent)' : 'var(--text-3)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{hint}</div>
      </div>
      <span style={{
        width: 34, height: 20, borderRadius: 99, flexShrink: 0, position: 'relative',
        background: on ? 'var(--accent)' : 'var(--border-2)', transition: 'background .15s',
      }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </span>
    </div>
  );
}

function ServiceScreen({ serviceId }) {
  const app = useApp();
  const L = app.L;
  const svc = FC.serviceById(serviceId);
  const loggedIn = !!app.state.logins[serviceId];
  const layout = app.t.settingsLayout;

  const panel = (compact) => <SettingsPanel svc={svc} loggedIn={loggedIn} compact={compact} />;

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <ServiceMark svc={svc} size={26} active={loggedIn} />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{svc.name}</div>
      <div style={{ flex: 1 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-3)', cursor: 'pointer' }}
             onClick={() => app.actions.setLogin(serviceId, !loggedIn)}>
        <span style={{ fontFamily: 'var(--mono)' }}>demo:</span>
        <span style={{ width: 30, height: 18, borderRadius: 99, position: 'relative', background: loggedIn ? 'var(--ok)' : 'var(--border-2)' }}>
          <span style={{ position: 'absolute', top: 2, left: loggedIn ? 14 : 2, width: 14, height: 14, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
        </span>
        {loggedIn ? L.loggedIn : L.notLoggedIn}
      </label>
      <Btn size="sm" variant="solid" icon="external">{L.openInBrowser}</Btn>
    </div>
  );

  const webview = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
      <UrlBar svc={svc} loggedIn={loggedIn} />
      <WebViewMock svc={svc} loggedIn={loggedIn} />
    </div>
  );

  if (layout === 'bottom') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {toolbar}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16, gap: 14 }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>{webview}</div>
          <div style={{ height: 248, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <BottomPanel svc={svc} loggedIn={loggedIn} />
          </div>
        </div>
      </div>
    );
  }

  if (layout === 'overlay') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {toolbar}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, padding: 16 }}>
          <div style={{ position: 'absolute', inset: 16, display: 'flex' }}>{webview}</div>
          <div style={{ position: 'absolute', right: 30, top: 30, bottom: 30, width: 360, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 70px rgba(0,0,0,.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {panel(true)}
          </div>
        </div>
      </div>
    );
  }

  // default: right
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {toolbar}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 16, gap: 14 }}>
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>{webview}</div>
        <div style={{ width: 366, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {panel(false)}
        </div>
      </div>
    </div>
  );
}

// horizontal variant of the settings panel (for bottom layout)
function BottomPanel({ svc, loggedIn }) {
  const app = useApp();
  const L = app.L;
  const allPosts = React.useMemo(() => FC.POSTS.filter((p) => p.service === svc.id), [svc.id]);
  const creators = FC.CREATORS[svc.id] || [];
  const [scope, setScope] = React.useState('new');
  const [types, setTypes] = React.useState({ image: true, video: true, file: true });
  const [since, setSince] = React.useState('2025-01');
  const [until, setUntil] = React.useState('2026-05');
  const newCount = allPosts.filter((p) => p.status !== 'done').length;
  const plan = React.useMemo(() => {
    let ps = allPosts.filter((p) => types[p.type]);
    if (scope === 'new') ps = ps.filter((p) => p.status !== 'done');
    if (scope === 'range') ps = ps.filter((p) => { const ym = `${p.year}-${String(p.month).padStart(2, '0')}`; return ym >= since && ym <= until; });
    const toGet = ps.filter((p) => p.status !== 'done');
    return { posts: toGet.length, files: toGet.reduce((s, p) => s + p.files, 0), sizeMB: toGet.reduce((s, p) => s + p.sizeMB, 0), items: toGet };
  }, [allPosts, types, scope, since, until]);
  const typeRow = [['image', L.images, 'image'], ['video', L.videos, 'play'], ['file', L.filesType, 'file']];
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', gap: 26, padding: '16px 20px', overflow: 'auto' }}>
        <div style={{ minWidth: 190 }}>
          <SectionLabel>{L.scope}</SectionLabel>
          <ScopeRadio value={scope} onChange={setScope} L={L} />
          {scope === 'range' && <RangePicker since={since} until={until} setSince={setSince} setUntil={setUntil} L={L} />}
        </div>
        <div style={{ minWidth: 170 }}>
          <SectionLabel>{L.fileTypes}</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {typeRow.map(([k, lbl, ic]) => (
              <div key={k} onClick={() => setTypes((t) => ({ ...t, [k]: !t[k] }))}
                   style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
                            border: '1px solid ' + (types[k] ? 'var(--accent)' : 'var(--border)'), background: types[k] ? 'var(--accent-tint)' : 'transparent', color: types[k] ? 'var(--accent)' : 'var(--text-3)' }}>
                <Icon name={ic} size={18} /><span style={{ fontSize: 11, fontWeight: 600 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <SectionLabel>{L.creators}</SectionLabel>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.9 }}>
            {creators.map((c) => c.name).join(' · ')}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{newCount} {L.newOnly}</div>
        </div>
      </div>
      <div style={{ width: 250, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{L.estimate}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.7 }}>
          {plan.posts} {L.postsUnit}<br />{plan.files} {L.filesUnit} · {FC.fmtSize(plan.sizeMB)}
        </div>
        <button onClick={() => loggedIn && plan.posts > 0 && app.actions.startDownload(svc, plan)} disabled={!loggedIn || !plan.posts}
                style={{ padding: '12px', borderRadius: 11, border: 'none', cursor: loggedIn && plan.posts ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                         background: loggedIn && plan.posts ? 'var(--accent)' : 'var(--surface-2)', color: loggedIn && plan.posts ? '#fff' : 'var(--text-3)' }}>
          <Icon name="download" size={17} strokeWidth={2.2} />{loggedIn ? L.startDownload : L.loginRequired}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ServiceScreen });
