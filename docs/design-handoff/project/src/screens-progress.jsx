/* fc-downloader — bulk download progress screen (animated) */

function ProgressScreen() {
  const app = useApp();
  const L = app.L;
  const dl = app.state.download;
  const svc = dl ? FC.serviceById(dl.svcId) : null;
  const items = dl ? dl.items : [];
  const totalFiles = React.useMemo(() => items.reduce((s, p) => s + p.files, 0), [items]);
  const totalSize = React.useMemo(() => items.reduce((s, p) => s + p.sizeMB, 0), [items]);
  const cum = React.useMemo(() => {
    let acc = 0; return items.map((p) => (acc += p.files));
  }, [items]);

  const [prog, setProg] = React.useState(0);          // files done (float)
  const [paused, setPaused] = React.useState(false);
  const TARGET = 18; // seconds
  const tickMs = 90;

  React.useEffect(() => { setProg(0); setPaused(false); }, [dl && dl.startedAt]);

  React.useEffect(() => {
    if (!dl || paused || prog >= totalFiles) return;
    const rate = totalFiles / (TARGET * (1000 / tickMs));
    const id = setInterval(() => {
      setProg((p) => {
        const np = Math.min(totalFiles, p + rate * (0.6 + Math.random() * 0.8));
        if (np >= totalFiles) { clearInterval(id); app.actions.markDownloadDone(); }
        return np;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [dl, paused, totalFiles, prog >= totalFiles]);

  if (!dl) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="download" size={40} style={{ margin: '0 auto 14px', opacity: 0.4 }} />
          <div style={{ fontSize: 15 }}>{L.noActiveDownload}</div>
        </div>
      </div>
    );
  }

  const done = prog >= totalFiles;
  const pct = totalFiles ? Math.min(100, (prog / totalFiles) * 100) : 0;
  const filesDone = Math.floor(prog);
  let curIdx = cum.findIndex((c) => c > prog);
  if (curIdx === -1) curIdx = items.length;
  const postsDone = curIdx;
  const sizeDone = Math.round(totalSize * (pct / 100));
  const speed = paused || done ? 0 : (totalSize / TARGET) * (0.7 + Math.random() * 0.6);
  const remainFiles = totalFiles - prog;
  const etaSec = done || paused ? 0 : Math.round(remainFiles / (totalFiles / TARGET));

  const stat = (label, value, sub) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* hero */}
      <div style={{ padding: '26px 30px 22px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <ServiceMark svc={svc} size={42} active />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>{svc.name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
              {done ? L.downloadComplete : paused ? L.paused : L.downloading}
              {!done && !paused && <span className="fc-pulse" style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent)' }} />}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 38, fontWeight: 700, color: done ? 'var(--ok)' : 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(pct)}<span style={{ fontSize: 20 }}>%</span>
          </div>
        </div>
        {/* bar */}
        <div style={{ height: 10, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', borderRadius: 99, background: done ? 'var(--ok)' : 'var(--accent)', transition: 'width .2s linear' }} />
        </div>
        {/* stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {stat(L.posts, `${postsDone}/${items.length}`)}
          {stat(L.filesUnit, `${filesDone}/${totalFiles}`)}
          {stat(L.size, FC.fmtSize(sizeDone), `/ ${FC.fmtSize(totalSize)}`)}
          {stat(L.speed, done ? '—' : speed.toFixed(1) + ' MB/s')}
          {stat(L.eta, done ? L.doneShort : paused ? '—' : `${etaSec}s`)}
        </div>
        {dl.dup > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="check" size={13} style={{ color: 'var(--ok)' }} />{dl.dup} {L.dupSkipped}
          </div>
        )}
        {/* controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {!done && (
            <Btn variant={paused ? 'primary' : 'solid'} icon={paused ? 'play' : 'pause'} onClick={() => setPaused(!paused)}>
              {paused ? L.resume : L.pauseBtn}
            </Btn>
          )}
          {done
            ? <Btn variant="primary" icon="library" onClick={() => app.go({ screen: 'library', svc: svc.id })}>{L.viewInLibrary}</Btn>
            : <Btn variant="danger" icon="x" onClick={() => app.actions.cancelDownload()}>{L.cancel}</Btn>}
          {done && <Btn variant="solid" icon="folder">{L.openFolder}</Btn>}
        </div>
      </div>

      {/* queue */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 18px 20px' }}>
        {items.map((p, i) => {
          const st = i < curIdx ? 'done' : i === curIdx && !done ? 'active' : done ? 'done' : 'queued';
          const itemPct = st === 'done' ? 100 : st === 'active' ? Math.round(((prog - (cum[i] - p.files)) / p.files) * 100) : 0;
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '9px 12px', borderRadius: 10,
              background: st === 'active' ? 'var(--accent-tint)' : 'transparent',
            }}>
              <div style={{ width: 46, flexShrink: 0 }}><Thumb post={p} radius={7} ratio="1 / 1" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{p.creatorName} · {p.year}/{String(p.month).padStart(2, '0')} · id_{p.id}</div>
                {st === 'active' && (
                  <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-2)', marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: Math.max(0, Math.min(100, itemPct)) + '%', background: 'var(--accent)', transition: 'width .2s linear' }} />
                  </div>
                )}
              </div>
              <div style={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
                {st === 'done' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ok)', fontWeight: 600 }}><Icon name="check" size={13} strokeWidth={2.6} />{L.doneShort}</span>}
                {st === 'active' && <span style={{ fontSize: 11.5, color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{Math.max(0, Math.min(p.files, Math.floor((itemPct / 100) * p.files)))}/{p.files}</span>}
                {st === 'queued' && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{L.queued}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { ProgressScreen });
