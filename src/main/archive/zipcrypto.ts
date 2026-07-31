/**
 * Traditional PKWARE zip encryption ("ZipCrypto") — the scheme ci-en creators
 * typically use for password-protected archives (WinZip AES, method 99, is a
 * different scheme and is not handled here).
 *
 * Pure JS on purpose: the app ships no native modules, so decryption has to be
 * implemented rather than delegated to a bundled 7-Zip/unzip binary.
 *
 * Each encrypted entry is prefixed with a 12-byte encryption header. Decrypting
 * it both primes the cipher and yields a one-byte check value, which lets us
 * reject a wrong password without inflating the entry.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

/** CRC-32 of `data` (also used to verify a decrypted entry). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function crcUpdate(crc: number, byte: number): number {
  return (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0
}

/** The cipher's rolling 3-word key state. */
export class ZipCryptoKeys {
  private k0 = 0x12345678
  private k1 = 0x23456789
  private k2 = 0x34567890

  constructor(password: string) {
    // Passwords are compared byte-wise; UTF-8 matches what modern zip tools write.
    for (const byte of Buffer.from(password, 'utf8')) this.update(byte)
  }

  private update(byte: number): void {
    this.k0 = crcUpdate(this.k0, byte)
    this.k1 = (this.k1 + (this.k0 & 0xff)) >>> 0
    this.k1 = (Math.imul(this.k1, 134775813) + 1) >>> 0
    this.k2 = crcUpdate(this.k2, this.k1 >>> 24)
  }

  private streamByte(): number {
    const temp = (this.k2 | 2) & 0xffff
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff
  }

  /** Decrypt in place and return the same buffer (the cipher is stateful). */
  decrypt(data: Uint8Array): Uint8Array {
    for (let i = 0; i < data.length; i++) {
      const plain = (data[i] ^ this.streamByte()) & 0xff
      this.update(plain)
      data[i] = plain
    }
    return data
  }
}

/** The 12-byte encryption header that prefixes every encrypted entry. */
export const ENCRYPTION_HEADER_SIZE = 12

/**
 * Decrypt an entry's 12-byte header and check it against the value the writer
 * stored (the CRC's high byte, or the mod-time's high byte when sizes are in a
 * data descriptor). A wrong password fails here ~255/256 of the time, so
 * candidates are cheap to test; callers still verify the CRC of real data.
 */
export function checkPassword(
  header: Uint8Array,
  keys: ZipCryptoKeys,
  crc: number,
  modTime: number,
  hasDataDescriptor: boolean
): boolean {
  // Copy first: decryption is in-place, and Buffer#slice returns a view, so
  // testing one candidate would otherwise corrupt the header for the next.
  const plain = keys.decrypt(Uint8Array.from(header.subarray(0, ENCRYPTION_HEADER_SIZE)))
  const expected = hasDataDescriptor ? (modTime >>> 8) & 0xff : (crc >>> 24) & 0xff
  return plain[ENCRYPTION_HEADER_SIZE - 1] === expected
}
