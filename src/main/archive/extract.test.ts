import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractZip } from './extract'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-zip-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('extractZip', () => {
  it('extracts files (including nested) into a sibling folder named after the zip', async () => {
    const zipped = zipSync({ 'a.txt': strToU8('hello'), 'sub/b.txt': strToU8('world') })
    const zipPath = join(dir, 'pack.zip')
    writeFileSync(zipPath, zipped)

    const out = await extractZip(zipPath)
    expect(out).toBe(join(dir, 'pack'))
    expect(readFileSync(join(out, 'a.txt'), 'utf8')).toBe('hello')
    expect(readFileSync(join(out, 'sub', 'b.txt'), 'utf8')).toBe('world')
  })

  it('skips zip-slip entries that escape the target folder', async () => {
    const zipped = zipSync({ '../evil.txt': strToU8('nope'), 'ok.txt': strToU8('yes') })
    const zipPath = join(dir, 'p.zip')
    writeFileSync(zipPath, zipped)

    const out = await extractZip(zipPath)
    expect(readFileSync(join(out, 'ok.txt'), 'utf8')).toBe('yes')
    expect(() => readFileSync(join(dir, 'evil.txt'), 'utf8')).toThrow() // never written outside
  })
})
