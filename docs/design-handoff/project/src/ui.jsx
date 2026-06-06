/* fc-downloader — shared UI primitives: Icon, Thumb, StatusDot, etc. */

const ICON_PATHS = {
  download:  'M12 3v12m0 0 4-4m-4 4-4-4M5 19h14',
  folder:    'M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  grid:      'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list:      'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  search:    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  gear:      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  heart:     'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  play:      'M7 4v16l13-8z',
  image:     'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 16l-5-5L5 21',
  file:      'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  check:     'M5 12l4.5 4.5L19 7',
  chevR:     'M9 6l6 6-6 6',
  chevD:     'M6 9l6 6 6-6',
  refresh:   'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  plus:      'M12 5v14M5 12h14',
  x:         'M6 6l12 12M18 6 6 18',
  eye:       'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  globe:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18',
  lock:      'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V8a4 4 0 0 1 8 0v3',
  cookie:    'M12 21a9 9 0 1 1 8.5-12 3 3 0 0 1-3.5 4 3 3 0 0 0-3.5 3.5A3 3 0 0 1 12 21z M8.5 9h.01M14 8h.01M9 14h.01M14.5 14h.01',
  hdd:       'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3zM3 10v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M7 15h.01',
  pause:     'M8 5v14M16 5v14',
  external:  'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  filter:    'M3 5h18l-7 8v6l-4 2v-8z',
  star:      'M12 3l2.7 5.7 6.3.9-4.5 4.4 1 6.3-5.5-3-5.5 3 1-6.3L3 9.6l6.3-.9z',
  library:   'M4 4h4v16H4zM10 4h4v16h-4zM17 5l3 .6-2.3 14.2-3-.6z',
  home:      'M3 11l9-8 9 8M5 10v10h14V10',
  clock:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  arrowL:    'M19 12H5M11 18l-6-6 6-6',
  arrowR:    'M5 12h14M13 6l6 6-6 6',
  trash:     'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  pin:       'M12 17v5M9 3h6l-1 7 3 3H7l3-3z',
  more:      'M5 12h.01M12 12h.01M19 12h.01',
  sort:      'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 4l-3 3',
  link:      'M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1',
  bell:      'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
};

const FILLED = new Set(['play', 'heart', 'star']);

function Icon({ name, size = 18, fill = false, style, strokeWidth = 1.7 }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const useFill = fill || FILLED.has(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={useFill ? 'currentColor' : 'none'}
         stroke={useFill ? 'none' : 'currentColor'}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'block', flexShrink: 0, ...style }}>
      {d.split(' M').map((seg, i) => (
        <path key={i} d={i === 0 ? seg : 'M' + seg} />
      ))}
    </svg>
  );
}

// ── striped placeholder thumbnail (no hand-drawn art) ──
function Thumb({ post, label, radius = 8, ratio }) {
  const hue = post ? post.hue : 220;
  const type = post ? post.type : 'image';
  const cap = label || (post ? `${type === 'video' ? 'MOV' : type === 'file' ? 'ZIP' : 'IMG'} · ${post.id}` : 'asset');
  const stripe = `repeating-linear-gradient(135deg, oklch(0.62 0.10 ${hue} / 0.16) 0 7px, transparent 7px 14px)`;
  const base = `linear-gradient(150deg, oklch(0.70 0.09 ${hue} / 0.22), oklch(0.58 0.11 ${hue} / 0.30))`;
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: ratio || '4 / 3',
      borderRadius: radius, overflow: 'hidden',
      background: base, backgroundBlendMode: 'normal',
      boxShadow: 'inset 0 0 0 1px var(--hairline)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: stripe }} />
      {type === 'video' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          color: 'oklch(0.30 0.05 ' + hue + ')',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 99, display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(2px)', paddingLeft: 3,
          }}>
            <Icon name="play" size={16} />
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute', left: 7, bottom: 6, fontFamily: 'var(--mono)',
        fontSize: 9.5, letterSpacing: '.02em', color: 'oklch(0.30 0.06 ' + hue + ')',
        background: 'rgba(255,255,255,.55)', padding: '1px 5px', borderRadius: 4,
      }}>{cap}</div>
    </div>
  );
}

// ── service badge: user-supplied logo if present, else monogram ──
function ServiceMark({ svc, size = 34, active = false, logo }) {
  const app = typeof useApp === 'function' ? useApp() : null;
  const src = logo !== undefined ? logo : app && app.state && app.state.brandLogos ? app.state.brandLogos[svc.id] : null;
  const radius = size * 0.28;
  if (src) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
        background: '#fff', boxShadow: active ? `0 4px 12px oklch(0.58 0.15 ${svc.hue} / 0.4)` : 'inset 0 0 0 1px var(--hairline)',
        transition: 'all .18s ease',
      }}>
        <img src={src} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      display: 'grid', placeItems: 'center', flexShrink: 0,
      fontFamily: 'var(--mono)', fontWeight: 600, fontSize: size * 0.46,
      color: active ? '#fff' : `oklch(0.55 0.13 ${svc.hue})`,
      background: active
        ? `oklch(0.58 0.15 ${svc.hue})`
        : `oklch(0.70 0.08 ${svc.hue} / 0.16)`,
      boxShadow: active ? `0 4px 12px oklch(0.58 0.15 ${svc.hue} / 0.4)` : 'none',
      transition: 'all .18s ease',
    }}>{svc.mark}</div>
  );
}

function StatusDot({ status, size = 7 }) {
  const c = status === 'done' ? 'var(--ok)' : status === 'partial' ? 'var(--warn)' : 'var(--accent)';
  return <span style={{ width: size, height: size, borderRadius: 99, background: c, flexShrink: 0, display: 'inline-block' }} />;
}

// ── app-wide context (tweaks, language dict, navigation, data state) ──
const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

// reusable pill button
function Btn({ children, onClick, variant = 'ghost', size = 'md', icon, active, style, title }) {
  const pads = size === 'sm' ? '5px 9px' : size === 'lg' ? '11px 18px' : '7px 13px';
  const fs = size === 'sm' ? 12 : size === 'lg' ? 14.5 : 13;
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center',
    padding: pads, fontSize: fs, fontWeight: 500, lineHeight: 1, cursor: 'pointer',
    borderRadius: 9, border: '1px solid transparent', fontFamily: 'inherit',
    transition: 'background .15s, border-color .15s, color .15s', whiteSpace: 'nowrap',
    userSelect: 'none',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px var(--accent-shadow)' },
    solid:   { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost:   { background: active ? 'var(--surface-2)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-2)' },
    danger:  { background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)' },
  };
  return (
    <button title={title} onClick={onClick} className={'fc-btn fc-btn-' + variant}
            style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

Object.assign(window, { Icon, Thumb, ServiceMark, StatusDot, ICON_PATHS, AppCtx, useApp, Btn });
