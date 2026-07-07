/**
 * The Service abstraction. Every supported site (Fantia, Fanbox, Patreon,
 * ci-en) implements this interface. The download engine, session manager and
 * UI are all written against this contract — adding a site means adding one
 * implementation and registering it, with no changes elsewhere.
 */
import type { Creator, Post, ServiceId } from '@shared/types'

/** One entry from a service's recent/home feed, for the "new posts" indicator. */
export interface RecentPost {
  creatorId: string
  postId: string
  /** Whether the logged-in user can download this post. Restricted/paywalled
   *  posts are not "downloadable new". Undefined = unknown (treated as maybe). */
  accessible?: boolean
}

/** Context handed to service methods (session-scoped fetch + logging). */
export interface ServiceContext {
  /**
   * Perform an HTTP request using the service's isolated session (cookies from
   * the user's interactive login in the embedded WebView are applied
   * automatically). Returns the parsed body.
   */
  fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T>
  fetchText(url: string, init?: RequestInit): Promise<string>
  /** Structured logger scoped to this service. */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: unknown) => void
  /** Cooperative cancellation for long enumerations / downloads. */
  signal: AbortSignal
  /**
   * Skip-existing fast path. On a skip-existing run, returns a network-free
   * {@link Post} stub (rebuilt from the ledger) when this post is already fully
   * downloaded for the run's file kinds — letting an adapter yield it WITHOUT
   * fetching its detail (a per-post, often rate-limited API call). Returns null
   * when the detail must be fetched. Absent on non-download contexts.
   */
  completedPostStub?(creatorId: string, postId: string): Post | null
}

export interface Service {
  readonly id: ServiceId
  readonly name: string
  /** URL opened in the embedded WebView for login / browsing. */
  readonly homeUrl: string

  /**
   * Extra HTTP headers to send when downloading this service's files. Some
   * sites serve media from a CDN that requires a Referer/Origin (e.g. Fanbox's
   * pximg). Applied by the download engine to every file request.
   */
  readonly downloadHeaders?: Record<string, string>

  /**
   * Best-effort check that the user is authenticated for this service, using
   * the current session cookies. Should be cheap (one lightweight request).
   */
  checkAuth(ctx: ServiceContext): Promise<boolean>

  /** Enumerate the creators the logged-in user supports / follows. */
  listCreators(ctx: ServiceContext): Promise<Creator[]>

  /**
   * Recent posts across the user's subscriptions, newest-first, by walking the
   * service's home/recent feed (cheap — NOT one request per creator). Used by
   * the "new posts" indicator to find creators whose newest downloadable post
   * isn't on disk yet. Walk at most `maxPages` feed pages. Optional: a service
   * without such a feed omits it (no indicator shown).
   */
  recentPosts?(ctx: ServiceContext, maxPages: number): AsyncIterable<RecentPost>

  /**
   * Enumerate posts for a creator. Implementations should paginate internally
   * and may yield incrementally for responsiveness.
   */
  listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post>

  /**
   * Cheaply count a creator's posts WITHOUT fetching per-post detail, so the
   * download engine can show a determinate progress total up front. Should only
   * walk the listing pages (post ids), not resolve each post. Optional: when
   * absent the engine falls back to an indeterminate progress bar.
   */
  countPosts?(ctx: ServiceContext, creatorId: string): Promise<number>

  /**
   * Optionally resolve a single post's full file list. Some sites only return
   * partial file metadata in the listing and need a per-post detail fetch.
   * If listPosts already returns complete files, this can just echo the input.
   */
  resolvePost?(ctx: ServiceContext, post: Post): Promise<Post>
}
