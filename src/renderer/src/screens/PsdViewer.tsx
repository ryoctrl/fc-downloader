/*
 * PSD viewer: open a downloaded .psd, toggle layer visibility live, and export
 * the current composite as PNG/JPG. Parsing + compositing run in the renderer
 * (ag-psd, pure JS) against the file bytes fetched over fcfile://.
 *
 * Compositing is a real bottom-to-top compositor: it honors clipping masks and
 * group isolation (opacity/blend), so "差分" PSDs render faithfully. Layer masks
 * and effects are not reproduced.
 *
 * Performance: the on-screen preview composites at a reduced resolution. Each
 * leaf's pixels are downscaled to that resolution ONCE (a per-layer cache), so
 * live toggles re-composite from small buffers instead of blitting every layer
 * at full res. Exports bypass the cache and render at full resolution.
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

/** A leaf layer's pixels pre-downscaled to preview resolution (built once). */
type PrevLayer = Layer & { __prev?: { data: ImageData; w: number; h: number } | null }

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

/** Local `YYYYMMDD_HHMMSS` stamp for unique export file names. */
function exportStamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
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

/**
 * Pre-downscale every leaf layer's pixels to the preview resolution ONCE and
 * cache it on the layer (`__prev`), so live toggles composite from small buffers
 * instead of blitting each layer at full res on every re-composite. Runs one
 * full-res blit per layer here (at load) to trade a one-time cost for cheap
 * toggles. `null` marks a layer with no usable pixels so we don't retry.
 */
function buildPreviewCache(layers: Layer[] | undefined, scale: number): void {
  const full = document.createElement('canvas')
  const fctx = full.getContext('2d')
  const small = document.createElement('canvas')
  const octx = small.getContext('2d')
  if (!fctx || !octx) return
  const walk = (arr: Layer[] | undefined): void => {
    for (const l of arr ?? []) {
      if (l.children) {
        walk(l.children)
        continue
      }
      const p = l as PrevLayer
      const im = l.imageData
      if (!im || im.width <= 0 || im.height <= 0) {
        p.__prev = null
        continue
      }
      const w = Math.max(1, Math.round(im.width * scale))
      const h = Math.max(1, Math.round(im.height * scale))
      full.width = im.width
      full.height = im.height
      const data = new Uint8ClampedArray(im.data.buffer as ArrayBuffer, im.data.byteOffset, im.data.byteLength)
      fctx.putImageData(new ImageData(data, im.width, im.height), 0, 0)
      small.width = w
      small.height = h
      octx.clearRect(0, 0, w, h)
      octx.imageSmoothingEnabled = true
      octx.imageSmoothingQuality = 'high'
      octx.drawImage(full, 0, 0, w, h)
      p.__prev = { data: octx.getImageData(0, 0, w, h), w, h }
    }
  }
  walk(layers)
}

/**
 * Composite the visible layers onto `canvas`, scaled by `scale` (1 = full res).
 *
 * This is a real PSD compositor, not a flat draw: layers go bottom-to-top, and
 * it handles **clipping masks** (a clipped layer only paints within the base
 * below it — 差分 art relies heavily on these) and **group isolation** (a group
 * is composited to its own buffer, then blended with the group's opacity/blend).
 * Without this the picture comes out muddy/wrong (clipped shading spills).
 *
 * Layers are decoded to CPU ImageData (not one <canvas> per layer) — hundreds of
 * GPU-backed canvases crash the GPU process — and blitted via a reused scratch
 * canvas; the group/clip buffers are freed as the recursion unwinds, so only a
 * handful of canvases are ever live.
 */
function compositeTo(
  canvas: HTMLCanvasElement,
  psd: Psd,
  hidden: Set<number>,
  scale: number,
  usePreview: boolean
): void {
  const cw = Math.max(1, Math.round((psd.width ?? 1) * scale))
  const ch = Math.max(1, Math.round((psd.height ?? 1) * scale))
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, cw, ch)

  const scratch = document.createElement('canvas')
  const sctx = scratch.getContext('2d')
  if (!sctx) return
  const buffer = (): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } => {
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    return { c, x: c.getContext('2d') as CanvasRenderingContext2D }
  }
  const visible = (l: Layer): boolean => !hidden.has((l as IdLayer).__id)

  /** Blit one leaf layer's pixels into `dc` at (alpha, blend). */
  const drawLeaf = (dc: CanvasRenderingContext2D, l: Layer, alpha: number, blend: GlobalCompositeOperation): void => {
    let src: CanvasImageSource | null = null
    let dw = 0
    let dh = 0
    const prev = usePreview ? (l as PrevLayer).__prev : null
    const im = l.imageData
    if (prev) {
      // Preview path: pixels already downscaled to `scale`; draw 1:1 (dest px).
      scratch.width = prev.data.width
      scratch.height = prev.data.height
      sctx.putImageData(prev.data, 0, 0)
      src = scratch
      dw = prev.w
      dh = prev.h
    } else if (im && im.width > 0 && im.height > 0) {
      scratch.width = im.width
      scratch.height = im.height
      const data = new Uint8ClampedArray(im.data.buffer as ArrayBuffer, im.data.byteOffset, im.data.byteLength)
      sctx.putImageData(new ImageData(data, im.width, im.height), 0, 0)
      src = scratch
      dw = im.width * scale
      dh = im.height * scale
    } else if (l.canvas && l.canvas.width > 0 && l.canvas.height > 0) {
      src = l.canvas
      dw = l.canvas.width * scale
      dh = l.canvas.height * scale
    }
    if (!src) return
    dc.globalAlpha = alpha
    dc.globalCompositeOperation = blend
    dc.drawImage(src, (l.left ?? 0) * scale, (l.top ?? 0) * scale, dw, dh)
    dc.globalAlpha = 1
    dc.globalCompositeOperation = 'source-over'
  }

  const drawContainer = (dc: CanvasRenderingContext2D, layers: Layer[] | undefined): void => {
    const arr = layers ?? []
    for (let i = 0; i < arr.length; ) {
      const base = arr[i]
      i++
      // Consume the run of clipping layers stacked directly above this base.
      const clips: Layer[] = []
      while (i < arr.length && (arr[i] as Layer & { clipping?: boolean }).clipping) clips.push(arr[i++])
      if (!visible(base)) continue

      const blend = BLEND[base.blendMode ?? 'normal'] ?? 'source-over'
      const op = base.opacity ?? 1

      // Render the base (leaf or group) into its own buffer at alpha 1 / normal;
      // its own opacity + blend are applied when the buffer lands on `dc`.
      const b = buffer()
      if (base.children) drawContainer(b.x, base.children)
      else drawLeaf(b.x, base, 1, 'source-over')

      let result = b.c
      if (clips.length) {
        // Clip layers blend against the base, confined to the base's alpha.
        const cl = buffer()
        cl.x.drawImage(b.c, 0, 0)
        for (const c of clips)
          if (visible(c)) drawLeaf(cl.x, c, c.opacity ?? 1, BLEND[c.blendMode ?? 'normal'] ?? 'source-over')
        cl.x.globalCompositeOperation = 'destination-in'
        cl.x.drawImage(b.c, 0, 0)
        cl.x.globalCompositeOperation = 'source-over'
        result = cl.c
      }

      dc.globalAlpha = op
      dc.globalCompositeOperation = blend
      dc.drawImage(result, 0, 0)
      dc.globalAlpha = 1
      dc.globalCompositeOperation = 'source-over'
    }
  }

  drawContainer(ctx, psd.children)
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
  onExported,
  L
}: {
  file: LibraryFile
  dirPath: string
  onClose: () => void
  /** Called after the user saves an export into the post folder, so the detail
   *  view can refresh its file list to show it immediately. */
  onExported?: (savedPath: string) => void
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
        // useImageData: decode layers to CPU ImageData, not GPU <canvas> — a big
        // PSD's hundreds of canvases otherwise crash the GPU process.
        const parsed = readPsd(ab, { useImageData: true })
        if (cancelled) return
        assignIds(parsed.children, { n: 0 })
        const h = new Set<number>()
        collectInitiallyHidden(parsed.children, h)
        // Downscale every layer to preview resolution once, up front, so live
        // toggles composite cheaply (see buildPreviewCache).
        const pv = Math.min(1, MAX_PREVIEW / Math.max(parsed.width ?? 1, parsed.height ?? 1))
        buildPreviewCache(parsed.children, pv)
        if (cancelled) return
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
    if (psd && canvasRef.current) compositeTo(canvasRef.current, psd, hidden, scale, true)
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
      // Export at full resolution (usePreview=false → original-size pixels).
      compositeTo(off, psd, hidden, 1, false)
      const blob = await new Promise<Blob | null>((res) =>
        off.toBlob(res, mime, mime === 'image/jpeg' ? 0.92 : undefined)
      )
      if (!blob) return
      const data = new Uint8Array(await blob.arrayBuffer())
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
      const base = file.name.replace(/\.psd$/i, '')
      // Timestamp the default name so repeated exports don't collide / overwrite.
      const suggested = `${dirPath.replace(/[\\/]+$/, '')}/${base}_${exportStamp()}.${ext}`
      const saved = await bridge.exportPsdImage(suggested, data)
      if (saved) {
        setSavedPath(saved)
        onExported?.(saved)
      }
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
