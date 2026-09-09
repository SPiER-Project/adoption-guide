/**
 * CRC-32 (IEEE 802.3), for the ZIP entries in xlsx-writer.mjs.
 *
 * `zlib.crc32` would now do — the floor is Node 22 (`.github/.nvmrc`) and it has
 * existed since 20.15 — but these twelve lines stay, because the reason that
 * outlives any version pin is the second one: they keep the writer's output
 * independent of the runtime's zlib. `build-use-case-workbook.mjs --check`
 * byte-diffs the .xlsx it produces, so the checksum has to be ours, not
 * whatever the runtime ships.
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
