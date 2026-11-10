/* Minimales ZIP zum Schreiben und Lesen – für die Komplett-Sicherung (Lernstand + Mini-Linux).
 * Komprimiert mit der eingebauten CompressionStream-API (deflate-raw), sonst unkomprimiert.
 * Kein ZIP64: Einträge bis 4 GB (die Sicherung ist deutlich kleiner). Läuft im Browser und in Node ≥ 18.
 */
(function (root) {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const canCompress = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  async function pipeThrough(bytes, stream) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(out);
  }
  const toBytes = (d) => (d instanceof Uint8Array ? d : typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d));

  /** entries: [{ name, data: string | ArrayBuffer | Uint8Array }] → Blob (application/zip) */
  async function create(entries) {
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const e of entries) {
      const raw = toBytes(e.data), name = new TextEncoder().encode(e.name);
      const crc = crc32(raw);
      let method = 0, body = raw;
      if (canCompress()) { const z = await pipeThrough(raw, new CompressionStream("deflate-raw")); if (z.length < raw.length) { method = 8; body = z; } }
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); // UTF-8-Namen
      local.setUint16(8, method, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true); local.setUint32(18, body.length, true); local.setUint32(22, raw.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, body);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, method, true); cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, body.length, true); cen.setUint32(24, raw.length, true);
      cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const cenSize = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  /** ZIP lesen → { name: Uint8Array }. Prüft die Prüfsummen. */
  async function read(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Das ist keine ZIP-Datei.");
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const files = {};
    for (let n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP-Inhaltsverzeichnis beschädigt.");
      const method = view.getUint16(p + 10, true), crc = view.getUint32(p + 16, true);
      const csize = view.getUint32(p + 20, true), nlen = view.getUint16(p + 28, true);
      const elen = view.getUint16(p + 30, true), clen = view.getUint16(p + 32, true), loc = view.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
      const start = loc + 30 + view.getUint16(loc + 26, true) + view.getUint16(loc + 28, true);
      let data = bytes.subarray(start, start + csize);
      if (method === 8) data = await pipeThrough(data, new DecompressionStream("deflate-raw"));
      else if (method !== 0) throw new Error(`Komprimierung ${method} wird nicht unterstützt.`);
      if (crc32(data) !== crc) throw new Error(`Datei ${name} in der ZIP ist beschädigt (Prüfsumme).`);
      files[name] = data;
      p += 46 + nlen + elen + clen;
    }
    return files;
  }

  const api = { create, read, crc32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RsZip = api;
})(this);
