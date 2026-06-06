/**
 * The Service abstraction. Every supported site (Fantia, Fanbox, Patreon,
 * ci-en) implements this interface. The download engine, session manager and
 * UI are all written against this contract — adding a site means adding one
 * implementation and registering it, with no changes elsewhere.
 */
import type { Creator, Post, ServiceId } from '@shared/types'

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
   * Enumerate posts for a creator. Implementations should paginate internally
   * and may yield incrementally for responsiveness.
   */
  listPosts(ctx: ServiceContext, creatorId: string): AsyncIterable<Post>

  /**
   * Optionally resolve a single post's full file list. Some sites only return
   * partial file metadata in the listing and need a per-post detail fetch.
   * If listPosts already returns complete files, this can just echo the input.
   */
  resolvePost?(ctx: ServiceContext, post: Post): Promise<Post>
}
