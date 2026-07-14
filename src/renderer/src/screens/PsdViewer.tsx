/*
 * PSD viewer: open a downloaded .psd, toggle layer visibility live, and export
 * the current composite as PNG/JPG. Parsing + compositing run in the renderer
 * (ag-psd, pure JS) against the file bytes fetched over fcfile://.
 *
 * Compositing is intentionally simple — it draws each visible leaf layer at its
 * position with its opacity and (canvas-supported) blend mode. That's faithful
 * for the common "差分" PSDs these target (normal-blend toggle layers). Group
 * opacity/blend and layer masks/clipping/effects are not fully reproduced.
 */
import { useEffect, useRef, useState } from 'react'
import { readPsd, type Layer, type Psd } from 'ag-psd'
import type { LibraryFile } from '@shared/types'
import type { Dict } from '../design/types'
import { Icon } from '../design/icons'
import { bridge } from '../bridge'

/** On-screen composite is capped to this longest edge for smooth toggling;
 *  exports always render at full resolution. */
const MAX_PREVIEW = 1600

type IdLayer = Layer & { __id: number }

/** Canvas blend ops keyed by ag-psd blend mode name (rest fall back to normal). */
const BLEND: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity'
}

function assignIds(layers: Layer[] | undefined, ctr: { n: number }): void {
  for (const l of layers ?? []) {
    const il = l as IdLayer
    il.__id = ctr.n++
    if (l.children) assignIds(l.children, ctr)
  }
}

function collectInitiallyHidden(layers: Layer[] | undefined, out: Set<number>): void {
  for (const l of layers ?? []) {
    if (l.hidden) out.add((l as IdLayer).__id)
    if (l.children) collectInitiallyHidden(l.children, out)
  }
}

/** Draw the visible layers (bottom-to-top = ag-psd child order) onto `canvas`,
 *  scaled by `scale` (1 = full resolution). */
function compositeTo(canvas: HTMLCanvasElement, psd: Psd, hidden: Set<number>, scale: number): void {
  canvas.width = Math.max(1, Math.round((psd.width ?? 1) * scale))
  canvas.height = Math.max(1, Math.round((psd.height ?? 1) * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const draw = (layers: Layer[] | undefined, ancestorsVisible: boolean): void => {
    for (const l of layers ?? []) {
      const visible = ancestorsVisible && !hidden.has((l as IdLayer).__id)
      if (l.children) {
        draw(l.children, visible)
      } else if (visible && l.canvas) {
        ctx.globalAlpha = l.opacity ?? 1
        ctx.globalCompositeOperation = BLEND[l.blendMode ?? 'normal'] ?? 'source-over'
        ctx.drawImage(
          l.canvas,
          (l.left ?? 0) * scale,
          (l.top ?? 0) * scale,
          l.canvas.width * scale,
          l.canvas.height * scale
        )
      }
    }
  }
  draw(psd.children, true)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/** One row (group or leaf) in the layer tree, top-first like Photoshop. */
function LayerRow({
  layer,
  depth,
  hidden,
  onToggle
}: {
  layer: Layer
  depth: number
  hidden: Set<number>
  onToggle: (id: number) => void
}) {
  const id = (layer as IdLayer).__id
  const isGroup = !!layer.children
  const visible = !hidden.has(id)
  return (
    <>
      <div
        onClick={() => onToggle(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 8px',
          paddingLeft: 8 + depth * 14,
          cursor: 'pointer',
          borderRadius: 7,
          opacity: visible ? 1 : 0.45
        }}
      >
        <span
          style={{
            width: 15,
            height: 15,
            flexShrink: 0,
            borderRadius: 4,
            display: 'grid',
            placeItems: 'center',
            border: '1.5px solid ' + (visible ? 'var(--accent)' : 'var(--text-3)'),
            background: visible ? 'var(--accent)' : 'transparent',
            color: '#fff'
          }}
        >
          {visible && <Icon name="check" size={10} strokeWidth={3} />}
        </span>
        <Icon
          name={isGroup ? 'folder' : 'image'}
          size={13}
          style={{ color: 'var(--text-3)', flexShrink: 0 }}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {layer.name || '(layer)'}
        </span>
      </div>
      {isGroup &&
        [...(layer.children ?? [])]
          .reverse()
          .map((c) => (
            <LayerRow key={(c as IdLayer).__id} layer={c} depth={depth + 1} hidden={hidden} onToggle={onToggle} />
          ))}
    </>
  )
}

export function PsdViewer({
  file,
  dirPath,
  onClose,
  L
}: {
  file: LibraryFile
  dirPath: string
  onClose: () => void
  L: Dict
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [psd, setPsd] = useState<Psd | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void (async () => {
      try {
        // Read the bytes via IPC (fetch() can't reach the fcfile:// scheme from
        // the app origin). ag-psd then decodes each layer into an HTMLCanvasElement.
        const bytes = await bridge.readPsdBytes(dirPath, file.name)
        if (cancelled) return
        if (!bytes) {
          setStatus('error')
          return
        }
        const ab = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer
        const parsed = readPsd(ab)
        if (cancelled) return
        assignIds(parsed.children, { n: 0 })
        const h = new Set<number>()
        collectInitiallyHidden(parsed.children, h)
        setPsd(parsed)
        setHidden(h)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dirPath, file.name])

  const scale = psd ? Math.min(1, MAX_PREVIEW / Math.max(psd.width ?? 1, psd.height ?? 1)) : 1
  useEffect(() => {
    if (psd && canvasRef.current) compositeTo(canvasRef.current, psd, hidden, scale)
  }, [psd, hidden, scale])

  const toggle = (id: number): void =>
    setHidden((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = async (mime: 'image/png' | 'image/jpeg'): Promise<void> => {
    if (!psd || saving) return
    setSaving(true)
    setSavedPath(null)
    try {
      const off = document.createElement('canvas')
      compositeTo(off, psd, hidden, 1)
      const blob = await new Promise<Blob | null>((res) =>
        off.toBlob(res, mime, mime === 'image/jpeg' ? 0.92 : undefined)
      )
      if (!blob) return
      const data = new Uint8Array(await blob.arrayBuffer())
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
      const base = file.name.replace(/\.psd$/i, '')
      const suggested = `${dirPath.replace(/[\\/]+$/, '')}/${base}.${ext}`
      const saved = await bridge.exportPsdImage(suggested, data)
      if (saved) setSavedPath(saved)
    } finally {
      setSaving(false)
    }
  }

  const topLevel = psd ? [...(psd.children ?? [])].reverse() : []

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(0,0,0,.86)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          color: '#fff',
          flexShrink: 0
        }}
      >
        <Icon name="image" size={17} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, opacity: 0.9 }}>{file.name}</span>
        {psd && (
          <span style={{ fontSize: 12, opacity: 0.6, fontFamily: 'var(--mono)' }}>
            {psd.width}×{psd.height}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            width: 38,
            height: 38,
            borderRadius: 99,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(255,255,255,.14)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <Icon name="x" size={19} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* canvas */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 18,
            overflow: 'auto'
          }}
        >
          {status === 'loading' && (
            <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="fc-spin"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 99,
                  border: '2px solid rgba(255,255,255,.3)',
                  borderTopColor: '#fff'
                }}
              />
              {L.psdLoading}
            </div>
          )}
          {status === 'error' && <div style={{ color: '#fff', opacity: 0.8 }}>{L.psdError}</div>}
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: status === 'ready' ? 'block' : 'none',
              // checkerboard so transparency is visible
              backgroundImage:
                'linear-gradient(45deg,#7a7a7a 25%,transparent 25%),linear-gradient(-45deg,#7a7a7a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#7a7a7a 75%),linear-gradient(-45deg,transparent 75%,#7a7a7a 75%)',
              backgroundSize: '18px 18px',
              backgroundPosition: '0 0,0 9px,9px -9px,-9px 0',
              backgroundColor: '#9a9a9a',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)'
            }}
          />
        </div>

        {/* layer panel */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <div
            style={{
              padding: '14px 16px 10px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              borderBottom: '1px solid var(--border)'
            }}
          >
            {L.layers}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
            {topLevel.map((l) => (
              <LayerRow key={(l as IdLayer).__id} layer={l} depth={0} hidden={hidden} onToggle={toggle} />
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
            {savedPath && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ok)',
                  marginBottom: 9,
                  wordBreak: 'break-all',
                  fontFamily: 'var(--mono)'
                }}
              >
                {L.psdSaved}: {savedPath}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => void save('image/png')}
                disabled={status !== 'ready' || saving}
                style={saveBtnStyle(status === 'ready' && !saving, true)}
              >
                <Icon name="download" size={15} />
                {saving ? L.psdSaving : 'PNG'}
              </button>
              <button
                onClick={() => void save('image/jpeg')}
                disabled={status !== 'ready' || saving}
                style={saveBtnStyle(status === 'ready' && !saving, false)}
              >
                <Icon name="download" size={15} />
                JPG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function saveBtnStyle(enabled: boolean, primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '10px',
    borderRadius: 9,
    border: primary ? 'none' : '1px solid var(--border)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    background: primary ? 'var(--accent)' : 'transparent',
    color: primary ? '#fff' : 'var(--text-2)',
    opacity: enabled ? 1 : 0.5
  }
}
