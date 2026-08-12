/**
 * CRC-32 (IEEE 802.3), for the ZIP entries in xlsx-writer.mjs.
 *
 * `zlib.crc32` exists from Node 20.15 and would do, but CI pins `node-version: 20`
 * — a floating minor. Twelve lines here removes the question entirely, and keeps
 * the writer's output independent of the runtime's zlib.
 */

const TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  TABLE[i] = c >>> 0
}

/** @param {Buffer|Uint8Array} buf @returns {number} unsigned 32-bit CRC */
export function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
