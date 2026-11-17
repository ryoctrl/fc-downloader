import { describe, expect, it, vi } from 'vitest'
import type { LibraryFile } from '@shared/types'
import { toViewPost } from './library'
import { scanLibraryImages, type ImageBatch } from './libraryImages'

function post(id: number) {
  return toViewPost({
    serviceId: 'fantia',
    creatorId: 'demo-creator',
    creatorName: 'Demo',
    postId: `demo-${id}`,
    title: `Demo ${id}`,
    postedAt: '2026-01-01',
    year: 2026,
    month: 1,
    dirPath: `/demo/${id}`,
    fileCount: 2,
    sizeBytes: 100,
    type: 'video',
    completed: true
  })
}

function file(name: string, kind: LibraryFile['kind'] = 'image'): LibraryFile {
  return { name, kind, url: `fcfile://fc/demo/${name}`, sizeBytes: 100 }
}

describe('library image scanning', () => {
  it('uses only supplied filtered posts, preserving post and file order across mixed media', async () => {
    const posts = [post(3), post(1)]
    const read = vi.fn(async (dir: string) =>
      dir === '/demo/3'
        ? [file('03.jpg'), file('clip.mp4', 'video'), file('04.png'), file('source.psd', 'file')]
        : [file('01.gif')]
    )
    const batches: ImageBatch[] = []
    await scanLibraryImages(
      posts,
      read,
      (batch) => batches.push(batch),
      new AbortController().signal
    )
    expect(read.mock.calls.map(([dir]) => dir)).toEqual(['/demo/3', '/demo/1'])
    expect(batches[0].images.map((image) => [image.post.key, image.name])).toEqual([
      [posts[0].key, '03.jpg'],
      [posts[0].key, '04.png'],
      [posts[1].key, '01.gif']
    ])
    expect(batches[0]).toMatchObject({ processed: 2, failed: 0 })
  })

  it('bounds pending folder reads and publishes in order even when reads finish backwards', async () => {
    const posts = Array.from({ length: 6 }, (_, i) => post(i))
    const pending: Array<(files: LibraryFile[]) => void> = []
    const read = vi.fn(() => new Promise<LibraryFile[]>((resolve) => pending.push(resolve)))
    const batches: ImageBatch[] = []
    const run = scanLibraryImages(
      posts,
      read,
      (batch) => batches.push(batch),
      new AbortController().signal
    )
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    for (let i = 3; i >= 0; i--) pending[i]([file(`${i}.jpg`)])
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6))
    expect(batches[0].images.map((image) => image.name)).toEqual([
      '0.jpg',
      '1.jpg',
      '2.jpg',
      '3.jpg'
    ])
    pending[5]([file('5.jpg')])
    pending[4]([file('4.jpg')])
    await run
    expect(batches[1].images.map((image) => image.name)).toEqual(['4.jpg', '5.jpg'])
    expect(batches[1].processed).toBe(6)
  })

  it('continues beyond empty, missing and rejected folders while reporting failed reads', async () => {
    const posts = Array.from({ length: 5 }, (_, i) => post(i))
    const read = vi.fn(async (dir: string) => {
      if (dir === '/demo/1') throw new Error('unavailable')
      return dir === '/demo/4' ? [file('last.jpg')] : []
    })
    const batches: ImageBatch[] = []
    await scanLibraryImages(
      posts,
      read,
      (batch) => batches.push(batch),
      new AbortController().signal
    )
    expect(batches).toHaveLength(2)
    expect(batches[1]).toMatchObject({ processed: 5, failed: 1 })
    expect(batches[1].images[0].name).toBe('last.jpg')
  })

  it('drops late results and stops scheduling after a filter change or leaving the view', async () => {
    const controller = new AbortController()
    const pending: Array<(files: LibraryFile[]) => void> = []
    const read = vi.fn(() => new Promise<LibraryFile[]>((resolve) => pending.push(resolve)))
    const publish = vi.fn()
    const run = scanLibraryImages(
      Array.from({ length: 8 }, (_, i) => post(i)),
      read,
      publish,
      controller.signal
    )
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    controller.abort()
    pending.forEach((resolve) => resolve([file('stale.jpg')]))
    await run
    expect(publish).not.toHaveBeenCalled()
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('does no work for an empty selection or an already cancelled scan', async () => {
    const controller = new AbortController()
    const read = vi.fn(async () => [])
    const publish = vi.fn()
    await scanLibraryImages([], read, publish, controller.signal)
    controller.abort()
    await scanLibraryImages([post(0)], read, publish, controller.signal)
    expect(read).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('treats a synchronous reader error like a rejected IPC call and continues scanning', async () => {
    const batches: ImageBatch[] = []
    const read = (dir: string): Promise<LibraryFile[]> => {
      if (dir === '/demo/0') throw new Error('bridge unavailable')
      return Promise.resolve([file('available.jpg')])
    }
    await scanLibraryImages(
      [post(0), post(1)],
      read,
      (batch) => batches.push(batch),
      new AbortController().signal
    )
    expect(batches[0]).toMatchObject({ processed: 2, failed: 1 })
    expect(batches[0].images.map((image) => image.name)).toEqual(['available.jpg'])
  })

  it('does not schedule another batch when cancelled after publishing visible images', async () => {
    const controller = new AbortController()
    const read = vi.fn(async () => [file('visible.jpg')])
    const publish = vi.fn(() => controller.abort())
    await scanLibraryImages(
      Array.from({ length: 12 }, (_, i) => post(i)),
      read,
      publish,
      controller.signal
    )
    expect(read).toHaveBeenCalledTimes(4)
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('keeps ordering and the four-read cap for a large library', async () => {
    const posts = Array.from({ length: 1000 }, (_, i) => post(i))
    let active = 0
    let peak = 0
    const images: string[] = []
    const read = vi.fn(async (dir: string) => {
      active++
      peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      return Array.from({ length: 20 }, (_, i) => file(`${dir}/${i}.jpg`))
    })
    let processed = 0
    await scanLibraryImages(
      posts,
      read,
      (batch) => {
        images.push(...batch.images.map((image) => image.name))
        processed = batch.processed
      },
      new AbortController().signal
    )
    expect(read).toHaveBeenCalledTimes(1000)
    expect(peak).toBe(4)
    expect(active).toBe(0)
    expect(processed).toBe(1000)
    expect(images).toHaveLength(20000)
    expect(images[0]).toBe('/demo/0/0.jpg')
    expect(images[images.length - 1]).toBe('/demo/999/19.jpg')
  })

  it('drains cancelled IPC requests before starting the replacement selection', async () => {
    let active = 0
    let peak = 0
    const pending: Array<() => void> = []
    const read = vi.fn(() => {
      active++
      peak = Math.max(peak, active)
      return new Promise<LibraryFile[]>((resolve) =>
        pending.push(() => {
          active--
          resolve([file('selected.jpg')])
        })
      )
    })
    const controller = new AbortController()
    const oldPublish = vi.fn()
    const oldScan = scanLibraryImages(
      Array.from({ length: 8 }, (_, i) => post(i)),
      read,
      oldPublish,
      controller.signal
    )
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    controller.abort()
    const newPublish = vi.fn()
    const newScan = scanLibraryImages([post(42)], read, newPublish, new AbortController().signal)
    await Promise.resolve()
    expect(read).toHaveBeenCalledTimes(4)
    pending.slice(0, 4).forEach((resolve) => resolve())
    await oldScan
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(5))
    pending[4]()
    await newScan
    expect(peak).toBe(4)
    expect(oldPublish).not.toHaveBeenCalled()
    expect(newPublish.mock.calls[0][0].images[0].post.postId).toBe('demo-42')
  })
})
