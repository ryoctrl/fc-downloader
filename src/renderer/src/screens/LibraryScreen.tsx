/* fc-downloader — file viewer (library): tree + grid/list + filters, real data */
import { Fragment, useEffect, useMemo, useState, type ReactNode, type UIEvent } from 'react'
import type { Dict, ServiceId, ViewMode } from '../design/types'
import { FC, fmtSize } from '../design/data'
import { libraryTotals, type ViewPost } from '../design/library'
import { Icon } from '../design/icons'
import { ServiceMark, StatusBadge, Thumb } from '../design/primitives'
import { useApp } from '../design/context'

interface TreeNode {
  kind: 'all' | 'service' | 'creator' | 'year' | 'month'
  service?: ServiceId
  creator?: string
  year?: number
  month?: number
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

function TreeRow({
  depth,
  icon,
  mark,
  label,
  count,
  open,
  onToggle,
  onSelect,
  selected,
  expandable
}: {
  depth: number
  icon?: string
  mark?: ReactNode
  label: string
  count?: number
  open?: boolean
  onToggle?: () => void
  onSelect?: () => void
  selected?: boolean
  expandable?: boolean
}) {
  return (
    <div
      onClick={onSelect}
      className="fc-tree-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 8px',
        paddingLeft: 8 + depth * 15,
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? 'var(--accent-tint)' : 'transparent',
        color: selected ? 'var(--accent)' : 'var(--text-2)'
      }}
    >
      <span
        onClick={(e) => {
          if (expandable) {
            e.stopPropagation()
            onToggle?.()
          }
        }}
        style={{ width: 14, display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--text-3)' }}
      >
        {expandable && <Icon name={open ? 'chevD' : 'chevR'} size={13} />}
      </span>
      {mark}
      {icon && <Icon name={icon} size={15} style={{ flexShrink: 0 }} />}
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: selected ? 600 : 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {label}
      </span>
      {count != null && (
        <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{count}</span>
      )}
    </div>
  )
}

/** Creator avatar for the tree: real image if saved on disk, else a folder. */
function CreatorAvatar({ iconUrl }: { iconUrl?: string }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          width: 18,
          height: 18,
          borderRadius: 99,
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--surface-2)'
        }}
      />
    )
  }
  return <Icon name="folder" size={15} style={{ flexShrink: 0 }} />
}

function LibraryTree({
  posts,
  node,
  setNode
}: {
  posts: ViewPost[]
  node: TreeNode
  setNode: (n: TreeNode) => void
}) {
  const app = useApp()
  const L = app.L
  const [exp, setExp] = useState<Set<string>>(() => new Set())
  const toggle = (k: string) =>
    setExp((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const same = (a: TreeNode, b: TreeNode) =>
    a.kind === b.kind &&
    a.service === b.service &&
    a.creator === b.creator &&
    a.year === b.year &&
    a.month === b.month

  const totals = libraryTotals(posts)
  const services = FC.SERVICES.filter((svc) => posts.some((p) => p.service === svc.id))

  return (
    <div
      style={{
        width: 246,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <div style={{ padding: '16px 16px 10px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{L.library}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {totals.posts} {L.postsUnit} · {fmtSize(totals.sizeMB)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 14px' }}>
        <TreeRow
          depth={0}
          icon="library"
          label={L.allPosts}
          count={totals.posts}
          selected={node.kind === 'all'}
          expandable={false}
          onSelect={() => setNode({ kind: 'all' })}
        />
        {services.map((svc) => {
          const sk = 'svc:' + svc.id
          const sopen = exp.has(sk)
          const sPosts = posts.filter((p) => p.service === svc.id)
          const creators = uniq(sPosts.map((p) => p.creator))
          return (
            <div key={svc.id}>
              <TreeRow
                depth={0}
                mark={<ServiceMark svc={svc} size={20} />}
                label={svc.name}
                count={sPosts.length}
                expandable
                open={sopen}
                onToggle={() => toggle(sk)}
                selected={same(node, { kind: 'service', service: svc.id })}
                onSelect={() => setNode({ kind: 'service', service: svc.id })}
              />
              {sopen &&
                creators.map((cr) => {
                  const ck = sk + ':' + cr
                  const copen = exp.has(ck)
                  const cPosts = sPosts.filter((p) => p.creator === cr)
                  const years = uniq(cPosts.map((p) => p.year)).sort((a, b) => b - a)
                  const crName = cPosts[0]?.creatorName ?? cr
                  const crIcon = cPosts[0]?.creatorIconUrl
                  return (
                    <div key={cr}>
                      <TreeRow
                        depth={1}
                        mark={<CreatorAvatar iconUrl={crIcon} />}
                        label={crName === cr ? cr : `${crName} (${cr})`}
                        count={cPosts.length}
                        expandable
                        open={copen}
                        onToggle={() => toggle(ck)}
                        selected={same(node, { kind: 'creator', service: svc.id, creator: cr })}
                        onSelect={() => setNode({ kind: 'creator', service: svc.id, creator: cr })}
                      />
                      {copen &&
                        years.map((yr) => {
                          const yk = ck + ':' + yr
                          const yopen = exp.has(yk)
                          const yPosts = cPosts.filter((p) => p.year === yr)
                          const months = uniq(yPosts.map((p) => p.month)).sort((a, b) => b - a)
                          return (
                            <div key={yr}>
                              <TreeRow
                                depth={2}
                                icon="folder"
                                label={String(yr)}
                                count={yPosts.length}
                                expandable
                                open={yopen}
                                onToggle={() => toggle(yk)}
                                selected={same(node, { kind: 'year', service: svc.id, creator: cr, year: yr })}
                                onSelect={() =>
                                  setNode({ kind: 'year', service: svc.id, creator: cr, year: yr })
                                }
                              />
                              {yopen &&
                                months.map((mo) => (
                                  <TreeRow
                                    key={mo}
                                    depth={3}
                                    icon="folder"
                                    label={String(mo).padStart(2, '0') + ' ' + L.month}
                                    count={yPosts.filter((p) => p.month === mo).length}
                                    expandable={false}
                                    selected={same(node, {
                                      kind: 'month',
                                      service: svc.id,
                                      creator: cr,
                                      year: yr,
                                      month: mo
                                    })}
                                    onSelect={() =>
                                      setNode({ kind: 'month', service: svc.id, creator: cr, year: yr, month: mo })
                                    }
                                  />
                                ))}
                            </div>
                          )
                        })}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FilterChip({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  icon?: string | null
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-2)'
      }}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  )
}

function typeIcon(type: ViewPost['type']): string {
  return type === 'video' ? 'play' : type === 'audio' ? 'play' : type === 'file' ? 'file' : 'image'
}

/** Real cover image if the post has one, else the striped placeholder. */
function Cover({ post, radius, ratio }: { post: ViewPost; radius: number; ratio: string }) {
  if (post.coverUrl) {
    return (
      <img
        src={post.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          width: '100%',
          aspectRatio: ratio,
          objectFit: 'cover',
          display: 'block',
          borderRadius: radius,
          background: 'var(--surface-2)'
        }}
      />
    )
  }
  return <Thumb hue={post.hue} type={post.type} radius={radius} ratio={ratio} />
}

export function PostCard({
  post,
  density,
  onOpen
}: {
  post: ViewPost
  density: string
  onOpen: () => void
}) {
  const app = useApp()
  const fav = app.state.favs.has(post.key)
  const svc = FC.serviceById(post.service)
  const pad = density === 'compact' ? 9 : 11
  return (
    <div
      onClick={onOpen}
      className="fc-card"
      style={{
        borderRadius: 13,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ position: 'relative' }}>
        <Cover post={post} radius={0} ratio="4 / 3" />
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 5 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 7px',
              borderRadius: 99,
              background: 'rgba(20,20,28,.62)',
              color: '#fff',
              fontSize: 10.5,
              fontFamily: 'var(--mono)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <Icon name={typeIcon(post.type)} size={11} />
            {post.files}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            app.actions.toggleFav(post.key)
          }}
          className="fc-fav"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 26,
            height: 26,
            borderRadius: 99,
            border: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(20,20,28,.5)',
            color: fav ? 'var(--fav)' : '#fff',
            backdropFilter: 'blur(4px)'
          }}
        >
          <Icon name="heart" size={14} fill={fav} />
        </button>
        <div style={{ position: 'absolute', left: 8, bottom: 8 }}>
          <StatusBadge status={post.status} L={app.L} />
        </div>
      </div>
      <div style={{ padding: `${pad}px ${pad + 1}px` }}>
        <div
          style={{
            fontSize: density === 'compact' ? 12.5 : 13.5,
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {post.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          <ServiceMark svc={svc} size={15} />
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1
            }}
          >
            {post.creatorName}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
            {post.year}/{String(post.month).padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  )
}

function PostRow({ post, onOpen }: { post: ViewPost; onOpen: () => void }) {
  const app = useApp()
  const L = app.L
  const fav = app.state.favs.has(post.key)
  const svc = FC.serviceById(post.service)
  return (
    <div
      onClick={onOpen}
      className="fc-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 14px',
        borderRadius: 10,
        cursor: 'pointer'
      }}
    >
      <div style={{ width: 44, flexShrink: 0 }}>
        <Cover post={post} radius={7} ratio="1 / 1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {post.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
          id_{post.postId}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 150, flexShrink: 0 }}>
        <ServiceMark svc={svc} size={17} />
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {post.creatorName}
        </span>
      </div>
      <div style={{ width: 86, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--text-3)' }}>
        {post.date}
      </div>
      <div style={{ width: 44, flexShrink: 0, color: 'var(--text-3)' }}>
        <Icon name={typeIcon(post.type)} size={15} />
      </div>
      <div
        style={{
          width: 50,
          flexShrink: 0,
          fontFamily: 'var(--mono)',
          fontSize: 11.5,
          color: 'var(--text-3)',
          textAlign: 'right'
        }}
      >
        {post.files}f
      </div>
      <div
        style={{
          width: 64,
          flexShrink: 0,
          fontFamily: 'var(--mono)',
          fontSize: 11.5,
          color: 'var(--text-3)',
          textAlign: 'right'
        }}
      >
        {fmtSize(post.sizeMB)}
      </div>
      <div style={{ width: 96, flexShrink: 0 }}>
        <StatusBadge status={post.status} L={L} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          app.actions.toggleFav(post.key)
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: fav ? 'var(--fav)' : 'var(--text-3)',
          flexShrink: 0
        }}
      >
        <Icon name="heart" size={16} fill={fav} />
      </button>
    </div>
  )
}

function nodeLabel(node: TreeNode, L: Dict): string[] {
  if (!node || node.kind === 'all') return [L.allPosts]
  const svc = FC.serviceById(node.service!)
  const out = [svc.name]
  if (node.creator) out.push(node.creator)
  if (node.year) out.push(String(node.year))
  if (node.month != null) out.push(String(node.month).padStart(2, '0'))
  return out
}

export function LibraryScreen() {
  const app = useApp()
  const L = app.L
  const allPosts = app.posts
  const startSvc = app.nav.screen === 'library' ? app.nav.svc : undefined
  const [node, setNode] = useState<TreeNode>(
    startSvc ? { kind: 'service', service: startSvc } : { kind: 'all' }
  )
  const [view, setView] = useState<ViewMode>(app.t.viewerView)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [sortDesc, setSortDesc] = useState(true)
  useEffect(() => {
    setView(app.t.viewerView)
  }, [app.t.viewerView])

  const posts = useMemo(() => {
    const matchNode = (p: ViewPost) => {
      if (!node || node.kind === 'all') return true
      if (node.service && p.service !== node.service) return false
      if (node.creator && p.creator !== node.creator) return false
      if (node.year && p.year !== node.year) return false
      if (node.month != null && p.month !== node.month) return false
      return true
    }
    let ps = allPosts.filter(matchNode)
    if (status !== 'all') ps = ps.filter((p) => p.status === status)
    if (type !== 'all') ps = ps.filter((p) => p.type === type)
    if (q.trim()) {
      const k = q.trim().toLowerCase()
      ps = ps.filter(
        (p) =>
          p.title.toLowerCase().includes(k) ||
          p.creatorName.toLowerCase().includes(k) ||
          p.postId.includes(k)
      )
    }
    return [...ps].sort((a, b) =>
      sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    )
  }, [allPosts, node, status, type, q, sortDesc])

  // Incremental rendering: only mount a window of cards/rows and grow it as the
  // user scrolls, so "All posts" with thousands of items stays responsive.
  const PAGE = 60
  const [visible, setVisible] = useState(PAGE)
  useEffect(() => {
    setVisible(PAGE)
  }, [posts])
  const shown = posts.slice(0, visible)
  const onScroll = (e: UIEvent<HTMLDivElement>): void => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 700) {
      setVisible((v) => (v < posts.length ? v + PAGE : v))
    }
  }

  const crumbs = nodeLabel(node, L)
  const density = app.t.density
  const minW = density === 'compact' ? 168 : 210

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <LibraryTree posts={allPosts} node={node} setNode={setNode} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              {crumbs.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <Icon name="chevR" size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      fontSize: i === crumbs.length - 1 ? 17 : 14,
                      fontWeight: i === crumbs.length - 1 ? 700 : 500,
                      color: i === crumbs.length - 1 ? 'var(--text)' : 'var(--text-3)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c}
                  </span>
                </Fragment>
              ))}
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginLeft: 4 }}>
                · {posts.length}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 12px',
                background: 'var(--surface-2)',
                borderRadius: 9,
                width: 220
              }}
            >
              <Icon name="search" size={15} style={{ color: 'var(--text-3)' }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L.search}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  minWidth: 0
                }}
              />
              {q && (
                <span onClick={() => setQ('')} style={{ display: 'flex', cursor: 'pointer' }}>
                  <Icon name="x" size={14} style={{ color: 'var(--text-3)' }} />
                </span>
              )}
            </div>
            <button
              onClick={() => setSortDesc(!sortDesc)}
              className="fc-btn fc-btn-solid"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 9px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontFamily: 'inherit'
              }}
            >
              <Icon name="sort" size={14} />
              {sortDesc ? L.newest : L.oldest}
            </button>
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 9, padding: 3 }}>
              {(['grid', 'list'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    width: 32,
                    height: 28,
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    background: view === v ? 'var(--surface)' : 'transparent',
                    color: view === v ? 'var(--accent)' : 'var(--text-3)',
                    boxShadow: view === v ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  <Icon name={v} size={16} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
            <FilterChip active={status === 'all'} onClick={() => setStatus('all')}>
              {L.allStatus}
            </FilterChip>
            <FilterChip active={status === 'done'} onClick={() => setStatus('done')} icon="check">
              {L.downloaded}
            </FilterChip>
            <FilterChip active={status === 'partial'} onClick={() => setStatus('partial')}>
              {L.partial}
            </FilterChip>
            <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />
            {(
              [
                ['all', L.allTypes, null],
                ['image', L.images, 'image'],
                ['video', L.videos, 'play'],
                ['file', L.filesType, 'file']
              ] as [string, string, string | null][]
            ).map(([v, lbl, ic]) => (
              <FilterChip key={v} active={type === v} onClick={() => setType(v)} icon={ic}>
                {lbl}
              </FilterChip>
            ))}
          </div>
        </div>
        <div
          onScroll={onScroll}
          style={{ flex: 1, overflow: 'auto', padding: view === 'grid' ? '18px 20px 28px' : '8px 14px 24px' }}
        >
          {allPosts.length === 0 ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
              <div style={{ textAlign: 'center' }}>
                <Icon name="library" size={34} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div>{L.libraryEmpty}</div>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
              <div style={{ textAlign: 'center' }}>
                <Icon name="search" size={34} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div>{L.noResults}</div>
              </div>
            </div>
          ) : view === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`,
                gap: density === 'compact' ? 12 : 16
              }}
            >
              {shown.map((p) => (
                <PostCard
                  key={p.key}
                  post={p}
                  density={density}
                  onOpen={() => app.go({ screen: 'post', postKey: p.key, from: 'library' })}
                />
              ))}
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '4px 14px 8px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--text-3)',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <div style={{ width: 44, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>{L.title}</div>
                <div style={{ width: 150, flexShrink: 0 }}>{L.creators}</div>
                <div style={{ width: 86, flexShrink: 0 }}>{L.posted}</div>
                <div style={{ width: 44, flexShrink: 0 }}>{L.type}</div>
                <div style={{ width: 50, flexShrink: 0, textAlign: 'right' }}>{L.filesUnit}</div>
                <div style={{ width: 64, flexShrink: 0, textAlign: 'right' }}>{L.size}</div>
                <div style={{ width: 96, flexShrink: 0 }}>{L.status}</div>
                <div style={{ width: 16, flexShrink: 0 }} />
              </div>
              {shown.map((p) => (
                <PostRow
                  key={p.key}
                  post={p}
                  onOpen={() => app.go({ screen: 'post', postKey: p.key, from: 'library' })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
