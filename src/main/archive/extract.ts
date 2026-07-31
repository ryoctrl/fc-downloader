/**
 * Cross-platform zip extraction (Windows / macOS / Linux).
 *
 * Plain archives go through fflate — a pure-JS unzip, so no native dependency
 * or OS unzip binary is required and behaviour is identical everywhere.
 *
 * Password-protected archives (ci-en creators commonly ship these) are handled
 * by a small reader of our own: fflate cannot decrypt, and the alternative —
 * bundling a 7-Zip binary — would break the project's no-native-modules rule.
 * That reader also reads entry by entry instead of holding the whole archive in
 * memory, which matters for the multi-hundred-MB builds these tend to be.
 * Only traditional ZipCrypto is supported (see zipcrypto.ts).
 */
import { mkdir, open, readFile, writeFile, type FileHandle } from 'node:fs/promises'
import { dirname, isAbsolute, join, normalize, relative } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { unzipSync } from 'fflate'
import { ENCRYPTION_HEADER_SIZE, ZipCryptoKeys, checkPassword, crc32 } from './zipcrypto'

/** Why an extraction couldn't complete, for the UI to act on. */
export type ExtractFailure = 'password-required' | 'password-wrong' | 'unsupported' | 'failed'

export class ExtractError extends Error {
  constructor(
    readonly reason: ExtractFailure,
    message: string
  ) {
    super(message)
    this.name = 'ExtractError'
  }
}

export interface ExtractOutcome {
  dir: string
  /** The password that worked, so the caller can remember it. */
  usedPassword?: string
}

interface CentralEntry {
  name: string
  flag: number
  method: number
  crc: number
  compressedSize: number
  localOffset: number
  modTime: number
}

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/** Destination folder for an archive: a sibling named after it. */
function targetDirFor(zipPath: string): string {
  return zipPath.replace(/\.zip$/i, '') || `${zipPath}_extracted`
}

/** Resolve an entry inside `targetDir`, or null if it escapes (zip-slip). */
function safeDest(targetDir: string, name: string): string | null {
  const dest = normalize(join(targetDir, name))
  const rel = relative(targetDir, dest)
  return rel.startsWith('..') || isAbsolute(rel) ? null : dest
}

/** Read the central directory (the archive's index). */
async function readCentralDirectory(fh: FileHandle, size: number): Promise<CentralEntry[]> {
  // The EOCD sits at the end, after an optional comment (max 64 KiB).
  const tailLen = Math.min(size, 66_000)
  const tail = Buffer.alloc(tailLen)
  await fh.read(tail, 0, tailLen, size - tailLen)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ExtractError('unsupported', 'end of central directory not found')

  const count = tail.readUInt16LE(eocd + 10)
  const cdSize = tail.readUInt32LE(eocd + 12)
  const cdOffset = tail.readUInt32LE(eocd + 16)
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff || count === 0xffff) {
    throw new ExtractError('unsupported', 'zip64 archives are not supported')
  }

  const cd = Buffer.alloc(cdSize)
  await fh.read(cd, 0, cdSize, cdOffset)
  const entries: CentralEntry[] = []
  let i = 0
  for (let n = 0; n < count && i + 46 <= cd.length; n++) {
    if (cd.readUInt32LE(i) !== SIG_CENTRAL) break
    const flag = cd.readUInt16LE(i + 8)
    const method = cd.readUInt16LE(i + 10)
    const modTime = cd.readUInt16LE(i + 12)
    const crc = cd.readUInt32LE(i + 16)
    const compressedSize = cd.readUInt32LE(i + 20)
    const nameLen = cd.readUInt16LE(i + 28)
    const extraLen = cd.readUInt16LE(i + 30)
    const commentLen = cd.readUInt16LE(i + 32)
    const localOffset = cd.readUInt32LE(i + 42)
    const name = cd.subarray(i + 46, i + 46 + nameLen).toString('utf8')
    entries.push({ name, flag, method, crc, compressedSize, localOffset, modTime })
    i += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** Offset of an entry's data, which follows its (variably sized) local header. */
async function dataOffset(fh: FileHandle, entry: CentralEntry): Promise<number> {
  const head = Buffer.alloc(30)
  await fh.read(head, 0, 30, entry.localOffset)
  if (head.readUInt32LE(0) !== SIG_LOCAL) {
    throw new ExtractError('failed', `bad local header for ${entry.name}`)
  }
  return entry.localOffset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
}

/** Try each candidate against the first encrypted entry; return the one that fits. */
async function findPassword(
  fh: FileHandle,
  entries: CentralEntry[],
  candidates: string[]
): Promise<string> {
  const probe = entries.find((e) => e.flag & 1 && !e.name.endsWith('/'))
  if (!probe) throw new ExtractError('failed', 'no encrypted entry to test')
  if (candidates.length === 0) {
    throw new ExtractError('password-required', 'this archive needs a password')
  }

  const start = await dataOffset(fh, probe)
  const header = Buffer.alloc(ENCRYPTION_HEADER_SIZE)
  await fh.read(header, 0, ENCRYPTION_HEADER_SIZE, start)
  for (const candidate of candidates) {
    const keys = new ZipCryptoKeys(candidate)
    if (checkPassword(header, keys, probe.crc, probe.modTime, (probe.flag & 8) !== 0)) {
      return candidate
    }
  }
  throw new ExtractError('password-wrong', 'none of the saved passwords fit this archive')
}

/** Inflate (if needed), optionally verify the CRC, and write one entry. */
async function writeEntry(
  dest: string,
  raw: Buffer,
  entry: CentralEntry,
  verifyCrc: boolean
): Promise<void> {
  let data: Uint8Array
  try {
    data = entry.method === 8 ? inflateRawSync(raw) : raw
  } catch {
    // Inflate only fails on garbage, which for an encrypted entry means the
    // 1-byte header check passed by luck (1/256) but the password is wrong.
    throw new ExtractError('password-wrong', `could not decompress ${entry.name}`)
  }
  if (verifyCrc && entry.crc !== 0 && crc32(data) !== entry.crc) {
    throw new ExtractError('password-wrong', `checksum mismatch for ${entry.name}`)
  }
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, data)
}

/** Extract an archive whose entries are ZipCrypto-encrypted. */
async function extractEncrypted(
  fh: FileHandle,
  entries: CentralEntry[],
  targetDir: string,
  candidates: string[]
): Promise<ExtractOutcome> {
  const password = await findPassword(fh, entries, candidates)
  await mkdir(targetDir, { recursive: true })
  let verified = false

  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue
    const dest = safeDest(targetDir, entry.name)
    if (!dest) continue // escapes the target folder — skip

    const encrypted = (entry.flag & 1) !== 0
    let offset = await dataOffset(fh, entry)
    let size = entry.compressedSize
    let keys: ZipCryptoKeys | undefined

    if (encrypted) {
      keys = new ZipCryptoKeys(password)
      const header = Buffer.alloc(ENCRYPTION_HEADER_SIZE)
      await fh.read(header, 0, ENCRYPTION_HEADER_SIZE, offset)
      keys.decrypt(header) // primes the cipher for the entry body
      offset += ENCRYPTION_HEADER_SIZE
      size -= ENCRYPTION_HEADER_SIZE
    }

    const body = Buffer.alloc(Math.max(0, size))
    if (body.length) await fh.read(body, 0, body.length, offset)
    if (keys) keys.decrypt(body)
    // Verify the first real entry: proves the password rather than trusting the
    // 1-byte check, and fails fast before writing a folder full of garbage.
    await writeEntry(dest, body, entry, encrypted && !verified)
    if (encrypted) verified = true
  }
  return { dir: targetDir, usedPassword: password }
}

/**
 * Extract `zipPath` into a sibling folder named after the archive. Entries that
 * would escape that folder are skipped (zip-slip guard).
 *
 * `passwords` are tried in order for an encrypted archive; the one that worked
 * comes back in the result so the caller can remember it for next time.
 */
export async function extractZip(zipPath: string, passwords: string[] = []): Promise<ExtractOutcome> {
  const targetDir = targetDirFor(zipPath)
  let encrypted: { fh: FileHandle; entries: CentralEntry[] } | null = null
  const fh = await open(zipPath, 'r')
  try {
    const { size } = await fh.stat()
    const entries = await readCentralDirectory(fh, size)
    if (entries.some((e) => e.flag & 1)) encrypted = { fh, entries }
  } catch (err) {
    if (err instanceof ExtractError && err.reason !== 'unsupported') {
      await fh.close()
      throw err
    }
    // Otherwise fall through to fflate, which copes with layouts we don't read.
  }

  if (encrypted) {
    try {
      return await extractEncrypted(encrypted.fh, encrypted.entries, targetDir, passwords)
    } finally {
      await fh.close()
    }
  }
  await fh.close()

  // Plain archive: fflate handles the long tail of zip variants.
  const buf = await readFile(zipPath)
  const unzipped = unzipSync(new Uint8Array(buf))
  await mkdir(targetDir, { recursive: true })
  for (const [name, data] of Object.entries(unzipped)) {
    if (name.endsWith('/') || data.length === 0) continue
    const dest = safeDest(targetDir, name)
    if (!dest) continue
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, data)
  }
  return { dir: targetDir }
}
