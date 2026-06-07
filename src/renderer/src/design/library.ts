/*
 * Real-data view model for the library. Maps backend `LibraryPost` records
 * (from posts:list) into a shape the design screens render. Replaces the mock
 * post data that used to live in design/data.ts.
 */
import type { LibraryPost, PostFileKind, ServiceId } from '@shared/types'
import { FC } from './data'

export type ViewStatus = 'done' | 'partial'

export interface ViewPost {
  /** Stable unique key: `serviceId/creatorId/postId`. */
  key: string
  service: ServiceId
  creator: string
  creatorName: string
  /** fcfile:// URL of the creator's avatar, if saved on disk. */
  creatorIconUrl?: string
  postId: string
  title: string
  year: number
  month: number
  /** YYYY-MM-DD. */
  date: string
  type: PostFileKind
  /** Number of files on disk. */
  files: number
  sizeMB: number
  status: ViewStatus
  hue: number
  /** fcfile:// URL of a real cover image, if the post has one. */
  coverUrl?: string
  /** Absolute folder on disk. */
  dirPath: string
}

export function postKey(serviceId: string, creatorId: string, postId: string): string {
  return `${serviceId}/${creatorId}/${postId}`
}

/** Deterministic hue offset so thumbnails vary per post but stay on-brand. */
function hashHue(base: number, seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const delta = (Math.abs(h) % 49) - 24 // -24..24
  return (base + delta + 360) % 360
}

export function toViewPost(lp: LibraryPost): ViewPost {
  const svc = FC.serviceById(lp.serviceId)
  return {
    key: postKey(lp.serviceId, lp.creatorId, lp.postId),
    service: lp.serviceId,
    creator: lp.creatorId,
    creatorName: lp.creatorName,
    creatorIconUrl: lp.creatorIconUrl,
    postId: lp.postId,
    title: lp.title,
    year: lp.year,
    month: lp.month,
    date: lp.postedAt.slice(0, 10),
    type: lp.type,
    files: lp.fileCount,
    sizeMB: lp.sizeBytes / (1024 * 1024),
    status: lp.completed ? 'done' : 'partial',
    hue: hashHue(svc.hue, lp.postId),
    coverUrl: lp.coverUrl,
    dirPath: lp.dirPath
  }
}

export interface ServiceCounts {
  posts: number
  sizeMB: number
}

export function countsForService(posts: ViewPost[], id: ServiceId): ServiceCounts {
  const ps = posts.filter((p) => p.service === id)
  return { posts: ps.length, sizeMB: ps.reduce((s, p) => s + p.sizeMB, 0) }
}

export function libraryTotals(posts: ViewPost[]): { posts: number; sizeMB: number } {
  return { posts: posts.length, sizeMB: posts.reduce((s, p) => s + p.sizeMB, 0) }
}
