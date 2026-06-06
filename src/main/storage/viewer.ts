/**
 * Builds the viewer tree (service -> creator -> year -> month -> post) by
 * walking the download root on disk. The folder layout itself is the index, so
 * the viewer reflects exactly what is present even if the DB is missing.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ViewerNode } from '@shared/types'

async function dirs(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

async function fileCount(path: string): Promise<number> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((e) => e.isFile()).length
  } catch {
    return 0
  }
}

export async function buildViewerTree(root: string): Promise<ViewerNode[]> {
  const services = await dirs(root)
  const tree: ViewerNode[] = []

  for (const service of services) {
    const servicePath = join(root, service)
    const creatorNodes: ViewerNode[] = []

    for (const creator of await dirs(servicePath)) {
      const creatorPath = join(servicePath, creator)
      const yearNodes: ViewerNode[] = []

      for (const year of await dirs(creatorPath)) {
        const yearPath = join(creatorPath, year)
        const monthNodes: ViewerNode[] = []

        for (const month of await dirs(yearPath)) {
          const monthPath = join(yearPath, month)
          const postNodes: ViewerNode[] = []

          for (const post of await dirs(monthPath)) {
            const postPath = join(monthPath, post)
            postNodes.push({
              key: `${service}/${creator}/${year}/${month}/${post}`,
              label: post,
              kind: 'post',
              path: postPath,
              fileCount: await fileCount(postPath)
            })
          }
          monthNodes.push({
            key: `${service}/${creator}/${year}/${month}`,
            label: month,
            kind: 'month',
            children: postNodes
          })
        }
        yearNodes.push({
          key: `${service}/${creator}/${year}`,
          label: year,
          kind: 'year',
          children: monthNodes
        })
      }
      creatorNodes.push({
        key: `${service}/${creator}`,
        label: creator,
        kind: 'creator',
        children: yearNodes
      })
    }
    tree.push({ key: service, label: service, kind: 'service', children: creatorNodes })
  }
  return tree
}
