import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ExtractError, extractZip } from './extract'

/**
 * A real ZipCrypto-encrypted archive (produced by 7-Zip, not by our own code, so
 * the decryptor is checked against an independent implementation). Synthetic
 * contents: `a.txt` = "hello from an encrypted zip", `sub/b.txt` = "nested
 * payload"; password "secret123".
 */
const ENCRYPTED_ZIP_BASE64 =
  'UEsDBBQAAQAAAPMdAV2m519ZJwAAABsAAAAFAAAAYS50eHQFsgkMe6DEFFy8HwRR4OkKe2opLr0Q1j/tw5HvrzAAt14XQxlL' +
  'FBtQSwMEFAAAAAAA8x0BXQAAAAAAAAAAAAAAAAQAAABzdWIvUEsDBBQAAQAAAPMdAV33cHmIGgAAAA4AAAAJAAAAc3ViL2Iu' +
  'dHh0bc9v+mIHcPdU+KpAjMMVx7g/3orMYjJfUNRQSwECPwAUAAEAAADzHQFdpudfWScAAAAbAAAABQAkAAAAAAAAACAAAAAA' +
  'AAAAYS50eHQKACAAAAAAAAEAGABuNQUOHSHdAQAAAAAAAAAAAAAAAAAAAABQSwECPwAUAAAAAADzHQFdAAAAAAAAAAAAAAAA' +
  'BAAkAAAAAAAAABAAAABKAAAAc3ViLwoAIAAAAAAAAQAYAHfeCA4dId0BAAAAAAAAAAAAAAAAAAAAAFBLAQI/ABQAAQAAAPMd' +
  'AV33cHmIGgAAAA4AAAAJACQAAAAAAAAAIAAAAGwAAABzdWIvYi50eHQKACAAAAAAAAEAGAAoBwkOHSHdAQAAAAAAAAAAAAAA' +
  'AAAAAABQSwUGAAAAAAMAAwAIAQAArQAAAAAA'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-zip-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** Write the encrypted fixture into the temp dir and return its path. */
function writeEncrypted(name = 'enc.zip'): string {
  const zipPath = join(dir, name)
  writeFileSync(zipPath, Buffer.from(ENCRYPTED_ZIP_BASE64, 'base64'))
  return zipPath
}

describe('extractZip', () => {
  it('extracts files (including nested) into a sibling folder named after the zip', async () => {
    const zipped = zipSync({ 'a.txt': strToU8('hello'), 'sub/b.txt': strToU8('world') })
    const zipPath = join(dir, 'pack.zip')
    writeFileSync(zipPath, zipped)

    const { dir: out } = await extractZip(zipPath)
    expect(out).toBe(join(dir, 'pack'))
    expect(readFileSync(join(out, 'a.txt'), 'utf8')).toBe('hello')
    expect(readFileSync(join(out, 'sub', 'b.txt'), 'utf8')).toBe('world')
  })

  it('skips zip-slip entries that escape the target folder', async () => {
    const zipped = zipSync({ '../evil.txt': strToU8('nope'), 'ok.txt': strToU8('yes') })
    const zipPath = join(dir, 'p.zip')
    writeFileSync(zipPath, zipped)

    const { dir: out } = await extractZip(zipPath)
    expect(readFileSync(join(out, 'ok.txt'), 'utf8')).toBe('yes')
    expect(() => readFileSync(join(dir, 'evil.txt'), 'utf8')).toThrow() // never written outside
  })

  it('decrypts a password-protected archive and reports the password that worked', async () => {
    const zipPath = writeEncrypted()
    const out = await extractZip(zipPath, ['secret123'])
    expect(out.usedPassword).toBe('secret123')
    expect(readFileSync(join(out.dir, 'a.txt'), 'utf8')).toBe('hello from an encrypted zip')
    expect(readFileSync(join(out.dir, 'sub', 'b.txt'), 'utf8')).toBe('nested payload')
  })

  it('finds the right password among several candidates', async () => {
    const zipPath = writeEncrypted()
    const out = await extractZip(zipPath, ['wrong', 'alsowrong', 'secret123'])
    expect(out.usedPassword).toBe('secret123')
  })

  it('asks for a password when none is supplied', async () => {
    const zipPath = writeEncrypted()
    await expect(extractZip(zipPath)).rejects.toMatchObject({ reason: 'password-required' })
  })

  it('reports a wrong password rather than writing garbage', async () => {
    const zipPath = writeEncrypted()
    await expect(extractZip(zipPath, ['nope', 'still-nope'])).rejects.toBeInstanceOf(ExtractError)
    await expect(extractZip(zipPath, ['nope'])).rejects.toMatchObject({ reason: 'password-wrong' })
  })
})
