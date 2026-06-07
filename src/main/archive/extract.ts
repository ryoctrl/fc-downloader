/**
 * Cross-platform zip extraction (Windows / macOS / Linux) using fflate — a
 * pure-JS unzip, so no native dependency or OS unzip binary is required and the
 * behaviour is identical on every platform.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative } from 'node:path'
import { unzipSync } from 'fflate'

/**
 * Extract `zipPath` into a sibling folder named after the archive (without the
 * `.zip`). Skips entries that would escape that folder (zip-slip guard).
 * Returns the destination folder path.
 */
export async function extractZip(zipPath: string): Promise<string> {
  const buf = await readFile(zipPath)
  const entries = unzipSync(new Uint8Array(buf))
  const targetDir = zipPath.replace(/\.zip$/i, '') || `${zipPath}_extracted`

  await mkdir(targetDir, { recursive: true })
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith('/') || data.length === 0) continue // directory marker
    const dest = normalize(join(targetDir, name))
    const rel = relative(targetDir, dest)
    if (rel.startsWith('..') || isAbsolute(rel)) continue // escapes target — skip
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, data)
  }
  return targetDir
}
