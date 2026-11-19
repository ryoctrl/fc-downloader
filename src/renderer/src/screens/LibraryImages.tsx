import { useEffect, useRef, useState } from 'react'
import { THUMBNAIL_WIDTH } from '@shared/constants'
import { bridge } from '../bridge'
import { ImageLightbox } from '../components/ImageLightbox'
import { useApp } from '../design/context'
import { FC } from '../design/data'
import { Icon } from '../design/icons'
import type { ViewPost } from '../design/library'
import { scanLibraryImages, type LibraryImage } from '../design/libraryImages'
import { ServiceMark } from '../design/primitives'

const PAGE = 60

function ImageCell({ image, onOpen }: { image: LibraryImage; onOpen: () => void }) {
  const app = useApp()
  const [failed, setFailed] = useState(false)
  const post = image.post
  return (
    <div
      className="fc-card"
      style={{
        borderRadius: 13,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        title={`${post.title} · ${image.name}`}
        aria-label={`${post.creatorName} · ${post.title} · ${image.name}`}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          aspectRatio: '4 / 3',
          padding: 0,
          border: 'none',
          cursor: 'zoom-in',
          background: 'var(--surface-2)',
          color: 'var(--text-3)'
        }}
      >
        {failed ? (
          <Icon name="image" size={26} />
        ) : (
          <img
            src={`${image.url}?w=${THUMBNAIL_WIDTH}`}
            alt={image.name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', minHeight: 0, objectFit: 'contain' }}
          />
        )}
      </button>
      <div style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 7 }}>
        <ServiceMark svc={FC.serviceById(post.service)} size={17} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={image.name}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text)'
            }}
          >
            {image.name}
          </div>
          <div
            title={`${post.creatorName} · ${post.title}`}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 3,
              fontSize: 11,
              color: 'var(--text-3)'
            }}
          >
            {post.creatorName} · {post.title}
          </div>
        </div>
        <button
          type="button"
          className="fc-btn-ghost"
          title={app.L.viewPost}
          aria-label={`${app.L.viewPost}: ${post.title}`}
          onClick={() => app.go({ screen: 'post', postKey: post.key, from: 'library' })}
          style={{
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            width: 28,
            height: 28,
            padding: 0,
            border: 'none',
            borderRadius: 7,
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer'
          }}
        >
          <Icon name="chevR" size={15} />
        </button>
      </div>
    </div>
  )
}

/** A projection of the library's already-filtered and sorted posts. It stays in
 * the library route so closing a full-size image preserves filters and scroll. */
export function LibraryImages({ posts }: { posts: ViewPost[] }) {
  const app = useApp()
  const L = app.L
  const [scan, setScan] = useState<{
    source: ViewPost[]
    images: LibraryImage[]
    processed: number
    failed: number
  }>({ source: posts, images: [], processed: 0, failed: 0 })
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState(PAGE)
  const [index, setIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Hide old results immediately when filters change, before the effect runs.
  const images = scan.source === posts ? scan.images : []
  const processed = scan.source === posts ? scan.processed : 0
  const loading = processed < posts.length
  useEffect(() => {
    const controller = new AbortController()
    setScan({ source: posts, images: [], processed: 0, failed: 0 })
    setVisible(PAGE)
    setIndex(null)
    scrollRef.current?.scrollTo(0, 0)
    void scanLibraryImages(
      posts,
      bridge.listFiles,
      (batch) => {
        setScan((previous) => ({
          source: posts,
          images: [...previous.images, ...batch.images],
          processed: batch.processed,
          failed: batch.failed
        }))
      },
      controller.signal
    )
    return () => controller.abort()
  }, [posts, attempt])

  // Also works when the first page does not fill the viewport. Re-observe when
  // another batch arrives so empty/mixed-media posts cannot stall the gallery.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visible >= images.length) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible((v) => v + PAGE)
      },
      { root: scrollRef.current, rootMargin: '700px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visible, images.length])

  const current = index == null ? undefined : images[index]
  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px 28px' }}
    >
      <div
        role="status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          fontSize: 12,
          color: 'var(--text-3)'
        }}
      >
        <Icon name="image" size={14} />
        <span>{L.libraryImagesHint}</span>
        <span style={{ fontFamily: 'var(--mono)' }}>
          · {images.length} {L.images}
        </span>
        {loading && (
          <span>
            · {L.loading} {processed}/{posts.length}
          </span>
        )}
        {scan.source === posts && scan.failed > 0 && (
          <>
            <span style={{ color: 'var(--warn)' }}>
              {L.imageScanFailed.replace('{n}', String(scan.failed))}
            </span>
            <button
              type="button"
              className="fc-btn fc-btn-ghost"
              disabled={loading}
              onClick={() => setAttempt((n) => n + 1)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 7,
                background: 'transparent',
                padding: '3px 8px',
                color: 'var(--text-2)',
                cursor: loading ? 'default' : 'pointer',
                font: 'inherit'
              }}
            >
              {L.refresh}
            </button>
          </>
        )}
      </div>
      {images.length === 0 ? (
        <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="image" size={34} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          {loading ? L.loading : L.noLibraryImages}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${app.t.density === 'compact' ? 168 : 210}px, 1fr))`,
            gap: app.t.density === 'compact' ? 12 : 16
          }}
        >
          {images.slice(0, visible).map((image, i) => (
            <ImageCell
              key={`${image.post.key}/${image.url}`}
              image={image}
              onOpen={() => setIndex(i)}
            />
          ))}
        </div>
      )}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {current && index != null && (
        <ImageLightbox
          L={L}
          images={images}
          index={index}
          loading={loading}
          onClose={() => setIndex(null)}
          onNav={(delta) =>
            setIndex((i) => (i == null ? i : (i + delta + images.length) % images.length))
          }
          caption={
            <>
              <span
                title={current.name}
                style={{
                  maxWidth: '70vw',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {current.name}
              </span>
              <span
                title={`${current.post.creatorName} · ${current.post.title}`}
                style={{
                  maxWidth: '70vw',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  opacity: 0.7
                }}
              >
                {current.post.creatorName} · {current.post.title}
              </span>
            </>
          }
        />
      )}
    </div>
  )
}
