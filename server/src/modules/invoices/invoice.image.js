// Shared JPEG/PNG decoding + local-media resolution for the hand-rolled PDF
// writer (invoice.pdf.js). No external image library — PNG decoding uses
// only Node's built-in zlib (inflate/deflate) plus a minimal hand-written
// chunk/scanline-filter parser; JPEG bytes are embedded as-is under
// /DCTDecode (no re-encoding needed).
//
// Documented limitations (acceptable simplifications for a hand-rolled
// writer, callers must treat any thrown error here as "can't embed, fall
// back to text"):
//  - PNG: only 8-bit-per-channel, non-interlaced Grayscale/RGB/RGBA (color
//    types 0, 2, 6) are supported. Indexed-color (palette, type 3), 16-bit
//    channels, and Adam7-interlaced PNGs throw and are not supported.
//  - PNG alpha: preserved as a PDF /SMask (soft mask) XObject rather than
//    dropped, so transparent logos/signatures still render correctly
//    against the invoice's white background.
//  - JPEG: only baseline/progressive SOF markers are parsed for
//    width/height; the compressed scan data itself is never touched, so
//    any valid JPEG (baseline or progressive) embeds correctly since actual
//    decoding happens in the PDF viewer.
import zlib from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { PUBLIC_UPLOAD_PREFIX, uploadRootDir } from "../uploads/storage.js";

export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  return null;
}

function parseJpegDimensions(buffer) {
  let offset = 2; // skip SOI (0xFFD8)
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0-SOF15 (excluding DHT/JPG/DAC markers 0xC4/0xC8/0xCC) all carry
    // height/width at the same offsets within the segment.
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  throw new Error("Could not locate JPEG SOF marker");
}

export function decodeJpegForPdf(buffer) {
  const { width, height } = parseJpegDimensions(buffer);
  if (!width || !height) throw new Error("Invalid JPEG dimensions");
  return { type: "jpeg", width, height, colorSpace: "DeviceRGB", bitsPerComponent: 8, filter: "DCTDecode", data: buffer, smaskData: null };
}

// --- Minimal PNG decoder (8-bit Grayscale/RGB/RGBA, non-interlaced only) ---

function readPngChunks(buffer) {
  const chunks = [];
  let offset = 8; // skip PNG signature
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length; // length(4) + type(4) + data + crc(4)
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanlines(raw, width, height, channels) {
  const bpp = channels; // bytes per pixel at 8 bits/channel
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let rawOffset = 0;
  let prevRowStart = -1;
  for (let row = 0; row < height; row += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = row * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[rawOffset + i];
      const a = i >= bpp ? out[rowStart + i - bpp] : 0;
      const b = prevRowStart >= 0 ? out[prevRowStart + i] : 0;
      const c = prevRowStart >= 0 && i >= bpp ? out[prevRowStart + i - bpp] : 0;
      let value;
      switch (filterType) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + Math.floor((a + b) / 2); break;
        case 4: value = x + paeth(a, b, c); break;
        default: throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      out[rowStart + i] = value & 0xff;
    }
    rawOffset += stride;
    prevRowStart = rowStart;
  }
  return out;
}

export function decodePngForPdf(buffer) {
  const chunks = readPngChunks(buffer);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("PNG missing IHDR chunk");
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  if (interlace !== 0) throw new Error("Interlaced PNGs are not supported");
  const channelsByColorType = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels) throw new Error(`Unsupported PNG color type: ${colorType}`);

  const idatChunks = chunks.filter((c) => c.type === "IDAT").map((c) => c.data);
  if (!idatChunks.length) throw new Error("PNG has no IDAT data");
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = unfilterScanlines(raw, width, height, channels);

  let rgb;
  let alpha = null;
  const n = width * height;
  if (colorType === 2) {
    rgb = pixels;
  } else if (colorType === 0) {
    rgb = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i += 1) { const g = pixels[i]; rgb[i * 3] = g; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = g; }
  } else if (colorType === 4) {
    rgb = Buffer.alloc(n * 3);
    alpha = Buffer.alloc(n);
    for (let i = 0; i < n; i += 1) { const g = pixels[i * 2]; rgb[i * 3] = g; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = g; alpha[i] = pixels[i * 2 + 1]; }
  } else if (colorType === 6) {
    rgb = Buffer.alloc(n * 3);
    alpha = Buffer.alloc(n);
    for (let i = 0; i < n; i += 1) { rgb[i * 3] = pixels[i * 4]; rgb[i * 3 + 1] = pixels[i * 4 + 1]; rgb[i * 3 + 2] = pixels[i * 4 + 2]; alpha[i] = pixels[i * 4 + 3]; }
  }

  return {
    type: "png",
    width,
    height,
    colorSpace: "DeviceRGB",
    bitsPerComponent: 8,
    filter: "FlateDecode",
    data: zlib.deflateSync(rgb),
    smaskData: alpha ? zlib.deflateSync(alpha) : null,
  };
}

export function decodeImageForPdf(buffer) {
  const kind = sniffImageType(buffer);
  if (kind === "jpeg") return decodeJpegForPdf(buffer);
  if (kind === "png") return decodePngForPdf(buffer);
  throw new Error("Unsupported image format (only JPEG and PNG are supported)");
}

// Safely resolves an invoice branding URL (logoUrl/signatureUrl, as stored
// by the admin settings form via the media upload endpoint) to local bytes
// WITHOUT ever reading an arbitrary filesystem path or fetching a remote
// URL. Only URLs produced by this app's own local media storage
// (server/src/modules/uploads/storage.js, PUBLIC_UPLOAD_PREFIX =
// "/uploads/products") are resolved; anything else (S3/CDN URLs, external
// http(s) URLs, absolute filesystem paths) returns null so the caller falls
// back to text. path.basename() strips any directory components/traversal
// before joining onto the fixed, non-configurable upload root.
export async function readLocalMediaFile(url) {
  if (!url || typeof url !== "string" || !url.startsWith(PUBLIC_UPLOAD_PREFIX)) return null;
  const filename = path.basename(url);
  if (!filename || filename === "." || filename === "..") return null;
  const filePath = path.join(uploadRootDir, filename);
  if (!filePath.startsWith(path.resolve(uploadRootDir))) return null;
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

// Combines resolve + decode; used by invoice.pdf.js for both logo and
// signature. Never throws — returns null on any failure (missing file,
// unsupported/corrupt format), so callers can unconditionally fall back to
// the pre-existing text rendering.
export async function loadEmbeddableImage(url) {
  try {
    const buffer = await readLocalMediaFile(url);
    if (!buffer || !buffer.length) return null;
    return decodeImageForPdf(buffer);
  } catch {
    return null;
  }
}
