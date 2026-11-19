import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LibraryFile } from '@shared/types'
import type { Dict } from '../design/types'
import { Icon } from '../design/icons'

export function ImageLightbox({
  images,
  index,
  onClose,
  onNav,
  L,
  caption,
  loading = false
}: {
  images: LibraryFile[]
  index: number
  onClose: () => void
  onNav: (delta: number) => void
  L: Dict
  caption?: ReactNode
  loading?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const canPrev = images.length > 1 && (!loading || index > 0)
  const canNext = images.length > 1 && (!loading || index < images.length - 1)
  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') {
        if (canPrev) onNav(-1)
      } else if (e.key === 'ArrowRight') {
        if (canNext) onNav(1)
      } else if (e.key === 'Tab') {
        const buttons =
          rootRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!buttons?.length) return
        const current = Array.from(buttons).findIndex((button) => button === document.activeElement)
        const next = (current + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
        e.preventDefault()
        buttons[next].focus({ preventScroll: true })
        return
      } else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNav, canPrev, canNext])
  const img = images[index]
  if (!img) return null
  const navButton = (dir: 'L' | 'R'): ReactNode => (
    <button
      type="button"
      aria-label={dir === 'L' ? L.prev : L.next}
      title={dir === 'L' ? L.prev : L.next}
      disabled={dir === 'L' ? !canPrev : !canNext}
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
        cursor: (dir === 'L' ? canPrev : canNext) ? 'pointer' : 'default',
        opacity: (dir === 'L' ? canPrev : canNext) ? 1 : 0.35,
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
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={L.images}
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
      {failedUrl === img.url ? (
        <div role="status" style={{ color: '#fff', padding: 40 }}>
          {L.imageUnavailable}
        </div>
      ) : (
        <img
          key={img.url}
          src={img.url}
          onError={() => setFailedUrl(img.url)}
          alt={img.name}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: caption ? '86vw' : '92vw',
            maxHeight: caption ? 'calc(100vh - 180px)' : '88vh',
            transform: caption ? 'translateY(-20px)' : undefined,
            borderRadius: 8,
            boxShadow: '0 20px 60px rgba(0,0,0,.5)'
          }}
        />
      )}
      <button
        ref={closeRef}
        type="button"
        aria-label={L.close}
        title={`${L.close} (Esc)`}
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
        </>
      )}
      {(caption || images.length > 1 || loading) && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '80vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
            padding: caption ? '7px 14px' : '5px 12px',
            borderRadius: caption ? 10 : 99,
            background: caption ? 'rgba(0,0,0,.65)' : 'rgba(0,0,0,.5)',
            color: '#fff',
            fontSize: 12.5
          }}
        >
          {caption}
          <span style={{ fontFamily: 'var(--mono)' }}>
            {index + 1} / {images.length}
            {loading ? ` · ${L.loading}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
