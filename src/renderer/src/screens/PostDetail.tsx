/* fc-downloader — post detail with real media preview (fcfile:// files) */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { LibraryFile } from '@shared/types'
import { THUMBNAIL_WIDTH } from '@shared/constants'
import { FC, fmtSize } from '../design/data'
import type { Dict } from '../design/types'
import type { ViewPost } from '../design/library'
import { Icon } from '../design/icons'
import { Btn, ServiceMark, StatusBadge, Thumb } from '../design/primitives'
import { useApp } from '../design/context'
import { bridge } from '../bridge'
import { ensurePsdThumb } from '../psdCover'
import { PsdViewer } from './PsdViewer'

/** Shared base style for the post action buttons (favorite / open in browser /
 *  open folder) so they're visually consistent (same radius, border, height). */
const ACTION_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '10px 13px',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-2)'
}

/** Uppercase section heading for the media/file groups in the preview. */
function SectionHeading({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginTop: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--text-3)'
      }}
    >
      <Icon name={icon} size={13} />
      {label}
      <span style={{ fontFamily: 'var(--mono)' }}>· {count}</span>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12.5,
          color: 'var(--text)',
          fontWeight: 500,
          textAlign: 'right',
          fontFamily: 'var(--mono)'
        }}
      >
        {children}
      </span>
    </div>
  )
}

function FileRow({
  file,
  dirPath,
  L,
  onOpenPsd,
  onDelete
}: {
  file: LibraryFile
  dirPath: string
  L: Dict
  onOpenPsd: (file: LibraryFile) => void
  onDelete: (file: LibraryFile) => void
}) {
  const icon = file.kind === 'audio' ? 'play' : file.kind === 'video' ? 'play' : 'file'
  const isZip = /\.zip$/i.test(file.name)
  const isPsd = /\.psd$/i.test(file.name)
  // PSDs show a preview rendered from the file's composite. Use the pre-generated
  // thumbnail if listPostFiles found one, else render it on the fly (cached).
  const [thumb, setThumb] = useState<string | null>(file.thumbUrl ?? null)
  useEffect(() => {
    if (!isPsd || thumb) return
    let cancelled = false
    void ensurePsdThumb(dirPath, file.name).then((url) => {
      if (!cancelled && url) setThumb(url)
    })
    return () => {
      cancelled = true
    }
  }, [isPsd, thumb, dirPath, file.name])
  const [extracting, setExtracting] = useState(false)
  const extract = async (): Promise<void> => {
    if (extracting) return
    setExtracting(true)
    try {
      await bridge.extractArchive(dirPath, file.name)
    } finally {
      setExtracting(false)
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 11,
        background: 'var(--surface)',
        border: '1px solid var(--border)'
      }}
    >
      {isPsd && thumb ? (
        <img
          src={`${thumb}?w=${THUMBNAIL_WIDTH}`}
          alt={file.name}
          loading="lazy"
          decoding="async"
          onClick={() => onOpenPsd(file)}
          title={L.openPsd}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            objectFit: 'cover',
            borderRadius: 8,
            cursor: 'zoom-in',
            background: 'var(--surface-2)',
            boxShadow: 'inset 0 0 0 1px var(--hairline)'
          }}
        />
      ) : (
        <Icon name={icon} size={18} style={{ color: 'var(--accent)' }} />
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--mono)',
          fontSize: 12.5,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {file.name}
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-3)', flexShrink: 0 }}>
        {fmtSize(file.sizeBytes / (1024 * 1024))}
      </span>
      {isPsd && (
        <button
          onClick={() => onOpenPsd(file)}
          title={L.openPsd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            flexShrink: 0
          }}
        >
          <Icon name="image" size={13} />
          {L.openPsd}
        </button>
      )}
      {isZip && (
        <button
          onClick={() => void extract()}
          title={L.extractZip}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-2)',
            cursor: extracting ? 'default' : 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            flexShrink: 0,
            opacity: extracting ? 0.6 : 1
          }}
        >
          <Icon name="folder" size={13} />
          {extracting ? L.extracting : L.extractZip}
        </button>
      )}
      {file.deletable && (
        <button
          onClick={() => void onDelete(file)}
          title={L.deleteFile}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 9px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            flexShrink: 0
          }}
        >
          <Icon name="trash" size={13} />
        </button>
      )}
    </div>
  )
}

/** One image cell in the grid: click to zoom; a delete button appears on hover
 *  for user-added files (e.g. PSD exports). Downloaded images aren't deletable. */
function GridImage({
  img,
  index,
  L,
  onImageClick,
  onDelete
}: {
  img: LibraryFile
  index: number
  L: Dict
  onImageClick: (index: number) => void
  onDelete: (file: LibraryFile) => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      style={{ position: 'relative', display: 'block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img
        // Grid previews use the pre-generated thumbnail; the lightbox loads full-res.
        src={`${img.url}?w=${THUMBNAIL_WIDTH}`}
        alt={img.name}
        loading="lazy"
        decoding="async"
        onClick={() => onImageClick(index)}
        style={{
          width: '100%',
          borderRadius: 10,
          display: 'block',
          cursor: 'zoom-in',
          background: 'var(--surface-2)',
          boxShadow: 'inset 0 0 0 1px var(--hairline)'
        }}
      />
      {img.deletable && hover && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            void onDelete(img)
          }}
          title={L.deleteFile}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(0,0,0,.6)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <Icon name="trash" size={15} />
        </button>
      )}
    </div>
  )
}

function Preview({
  post,
  files,
  loaded,
  L,
  onImageClick,
  onOpenPsd,
  onDelete
}: {
  post: ViewPost
  files: LibraryFile[]
  loaded: boolean
  L: Dict
  onImageClick: (index: number) => void
  onOpenPsd: (file: LibraryFile) => void
  onDelete: (file: LibraryFile) => void
}) {
  const images = files.filter((f) => f.kind === 'image')
  const videos = files.filter((f) => f.kind === 'video')
  const audios = files.filter((f) => f.kind === 'audio')
  const others = files.filter((f) => f.kind === 'file')

  if (files.length === 0) {
    return (
      <Thumb hue={post.hue} type={post.type} radius={12} ratio="16 / 9" label={loaded ? L.noFiles : L.loading} />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {videos.length > 0 && <SectionHeading icon="play" label={L.videos} count={videos.length} />}
      {videos.map((v) => (
        <video
          key={v.url}
          src={v.url}
          controls
          preload="metadata"
          style={{ width: '100%', borderRadius: 12, background: '#000', boxShadow: 'var(--shadow-sm)' }}
        />
      ))}
      {audios.length > 0 && <SectionHeading icon="play" label={L.audios} count={audios.length} />}
      {audios.map((a) => (
        <div
          key={a.url}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 11,
            background: 'var(--surface)',
            border: '1px solid var(--border)'
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: 'var(--mono)',
              fontSize: 12.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {a.name}
          </div>
          <audio src={a.url} controls preload="metadata" style={{ height: 34 }} />
        </div>
      ))}
      {images.length > 0 && <SectionHeading icon="image" label={L.images} count={images.length} />}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {images.map((img, i) => (
            <GridImage key={img.url} img={img} index={i} L={L} onImageClick={onImageClick} onDelete={onDelete} />
          ))}
        </div>
      )}
      {others.length > 0 && <SectionHeading icon="file" label={L.filesType} count={others.length} />}
      {others.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {others.map((f) => (
            <FileRow key={f.url} file={f} dirPath={post.dirPath} L={L} onOpenPsd={onOpenPsd} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function Lightbox({
  images,
  index,
  onClose,
  onNav
}: {
  images: LibraryFile[]
  index: number
  onClose: () => void
  onNav: (delta: number) => void
}) {
  const img = images[index]
  if (!img) return null
  const navButton = (dir: 'L' | 'R'): ReactNode => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onNav(dir === 'L' ? -1 : 1)
      }}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...(dir === 'L' ? { left: 18 } : { right: 18 }),
        width: 44,
        height: 44,
        borderRadius: 99,
        border: 'none',
        cursor: 'pointer',
        background: 'rgba(255,255,255,.14)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <Icon name={dir === 'L' ? 'arrowL' : 'arrowR'} size={22} />
    </button>
  )
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,.85)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'center'
      }}
    >
      <img
        src={img.url}
        alt={img.name}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          width: 40,
          height: 40,
          borderRadius: 99,
          border: 'none',
          cursor: 'pointer',
          background: 'rgba(255,255,255,.14)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <Icon name="x" size={20} />
      </button>
      {images.length > 1 && (
        <>
          {navButton('L')}
          {navButton('R')}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 12px',
              borderRadius: 99,
              background: 'rgba(0,0,0,.5)',
              color: '#fff',
              fontSize: 12.5,
              fontFamily: 'var(--mono)'
            }}
          >
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

export function PostDetail() {
  const app = useApp()
  const L = app.L
  const key = app.nav.screen === 'post' ? app.nav.postKey : ''
  const from = app.nav.screen === 'post' ? app.nav.from : undefined
  const idx = app.posts.findIndex((p) => p.key === key)
  const post = app.posts[idx]
  const [files, setFiles] = useState<LibraryFile[]>([])
  const [loaded, setLoaded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [psdFile, setPsdFile] = useState<LibraryFile | null>(null)
  const images = files.filter((f) => f.kind === 'image')

  useEffect(() => {
    if (!post) return
    setLoaded(false)
    setFiles([])
    setLightboxIndex(null)
    let cancelled = false
    void bridge.listFiles(post.dirPath).then((fs) => {
      if (cancelled) return
      setFiles(fs)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // Only re-fetch when the post's folder changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.dirPath])

  // Re-read the folder (e.g. after a PSD export or a delete) so the change shows
  // without leaving and re-opening the post.
  const reload = useCallback(() => {
    const dir = post?.dirPath
    if (dir) void bridge.listFiles(dir).then(setFiles)
  }, [post?.dirPath])

  const onDelete = useCallback(
    async (f: LibraryFile) => {
      const dir = post?.dirPath
      if (!dir || !f.deletable) return
      if (!window.confirm(`${L.confirmDelete}\n${f.name}`)) return
      if (await bridge.deletePostFile(dir, f.name)) reload()
    },
    [post?.dirPath, reload, L]
  )

  // Keyboard control while the lightbox is open.
  useEffect(() => {
    if (lightboxIndex == null) return
    const n = images.length
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setLightboxIndex(null)
      else if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i == null ? i : (i - 1 + n) % n))
      else if (e.key === 'ArrowRight') setLightboxIndex((i) => (i == null ? i : (i + 1) % n))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, images.length])

  if (!post) return null
  const svc = FC.serviceById(post.service)
  const fav = app.state.favs.has(post.key)
  const prev = app.posts[idx - 1]
  const next = app.posts[idx + 1]
  const back = () => app.go(from === 'favorites' ? { screen: 'favorites' } : { screen: 'library' })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <Btn size="sm" variant="ghost" icon="arrowL" onClick={back}>
          {L.back}
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn
          size="sm"
          variant="ghost"
          icon="arrowL"
          onClick={() => prev && app.go({ screen: 'post', postKey: prev.key, from })}
          style={{ opacity: prev ? 1 : 0.35 }}
        >
          {L.prev}
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => next && app.go({ screen: 'post', postKey: next.key, from })}
          style={{ opacity: next ? 1 : 0.35 }}
        >
          {L.next}
          <Icon name="arrowR" size={16} />
        </Btn>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 26px', minWidth: 0 }}>
          <Preview
            post={post}
            files={files}
            loaded={loaded}
            L={L}
            onImageClick={setLightboxIndex}
            onOpenPsd={setPsdFile}
            onDelete={onDelete}
          />
        </div>
        <div
          style={{
            width: 332,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            overflow: 'auto',
            padding: '24px 22px',
            background: 'var(--surface)'
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <StatusBadge status={post.status} L={L} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>
            {post.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '14px 0 18px' }}>
            <ServiceMark svc={svc} size={32} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{post.creatorName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{svc.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => app.actions.toggleFav(post.key)}
              style={{
                ...ACTION_STYLE,
                flex: 1,
                ...(fav
                  ? { border: '1px solid transparent', background: 'var(--fav-tint)', color: 'var(--fav)' }
                  : {})
              }}
            >
              <Icon name="heart" size={16} fill={fav} />
              {fav ? L.favorited : L.favorite}
            </button>
            {post.postUrl && (
              <button
                onClick={() => bridge.openExternal(post.postUrl!)}
                title={L.openInBrowser}
                style={ACTION_STYLE}
              >
                <Icon name="external" size={16} />
              </button>
            )}
            <button
              onClick={() => bridge.openPath(post.dirPath)}
              title={L.openFolder}
              style={ACTION_STYLE}
            >
              <Icon name="folder" size={16} />
            </button>
          </div>
          <MetaRow label={L.posted}>{post.date}</MetaRow>
          <MetaRow label={L.type}>{post.type}</MetaRow>
          <MetaRow label={L.filesUnit}>{post.files}</MetaRow>
          <MetaRow label={L.size}>{fmtSize(post.sizeMB)}</MetaRow>
          <MetaRow label="ID">id_{post.postId}</MetaRow>
          <div
            style={{
              margin: '18px 0 8px',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)'
            }}
          >
            {L.folderPath}
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 9,
              background: 'var(--surface-2)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text-2)',
              lineHeight: 1.7,
              wordBreak: 'break-all'
            }}
          >
            {post.dirPath}
          </div>
        </div>
      </div>
      {lightboxIndex != null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={(d) =>
            setLightboxIndex((i) => (i == null ? i : (i + d + images.length) % images.length))
          }
        />
      )}
      {psdFile && (
        <PsdViewer
          file={psdFile}
          dirPath={post.dirPath}
          onClose={() => setPsdFile(null)}
          onExported={reload}
          L={L}
        />
      )}
    </div>
  )
}
