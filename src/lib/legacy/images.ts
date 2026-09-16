import sharp, { type Sharp } from 'sharp';
// @ts-expect-error - libheif-js ships no type declarations
import libheif from 'libheif-js/wasm-bundle';
import { fetchBinary } from './fetch';

/**
 * Image migration.
 *
 * The legacy site serves iPhone HEIC files straight to the browser, which
 * Chrome and Firefox cannot decode. Every image is re-encoded to WebP for
 * delivery while the untouched original is kept in a private bucket, so we
 * never lose the source quality we were given.
 *
 * HEIC decoding note: every HEIC on the legacy site has an item location that
 * overruns the end of the file by ~32 bytes. sharp's bundled libheif refuses
 * these outright ("bad seek"), but libheif's WASM build decodes them fine - the
 * pixel data is all there. So HEIC goes through libheif to raw RGBA and then
 * into sharp for resizing and encoding; everything else goes straight to sharp.
 */

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}

/** Decodes a HEIF/HEIC buffer to raw RGBA via libheif's WASM build. */
async function decodeHeic(buf: Buffer): Promise<RawImage> {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buf);

  if (!images?.length) throw new Error('HEIF container held no images');

  const image = images[0];
  const width: number = image.get_width();
  const height: number = image.get_height();
  const data = new Uint8ClampedArray(width * height * 4);

  await new Promise<void>((resolve, reject) => {
    image.display({ data, width, height }, (result: unknown) => {
      if (result) resolve();
      else reject(new Error('libheif could not render the image'));
    });
  });

  return { data: Buffer.from(data.buffer), width, height };
}

function isHeic(buffer: Buffer, url: string): boolean {
  if (/\.hei[cf]$/i.test(url.split('?')[0])) return true;
  // ISO-BMFF brand check: 'ftyp' at offset 4, then heic/heix/mif1/msf1.
  const brand = buffer.toString('latin1', 8, 12);
  return buffer.toString('latin1', 4, 8) === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim', 'heis'].includes(brand);
}

export interface ProcessedImage {
  /** WebP bytes for the browser. */
  optimized: Buffer;
  optimizedContentType: 'image/webp';
  /** The bytes exactly as downloaded. */
  original: Buffer;
  originalContentType: string;
  originalFormat: string;
  width: number;
  height: number;
  /** Inline base64 data URL, ~20 bytes of visual information, for blur-up. */
  placeholder: string;
  bytes: number;
}

export interface ProcessOptions {
  /** Longest-edge cap for the delivered image. */
  maxEdge?: number;
  quality?: number;
  force?: boolean;
}

const CONTENT_TYPES: Record<string, string> = {
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export function extensionOf(url: string): string {
  const clean = url.split('?')[0];
  return (clean.split('.').pop() ?? '').toLowerCase();
}

/** Downloads one image and produces web-ready WebP plus a blur-up placeholder. */
export async function processImage(
  url: string,
  { maxEdge = 1600, quality = 82, force }: ProcessOptions = {},
): Promise<ProcessedImage> {
  const original = await fetchBinary(url, { force });

  let pipeline: Sharp;
  let sourceFormat: string;

  if (isHeic(original, url)) {
    const raw = await decodeHeic(original);
    pipeline = sharp(raw.data, {
      raw: { width: raw.width, height: raw.height, channels: 4 },
    });
    sourceFormat = 'heic';
  } else {
    // .rotate() with no argument applies the EXIF orientation tag and clears it.
    pipeline = sharp(original, { failOn: 'none' }).rotate();
    sourceFormat = (await pipeline.metadata()).format ?? extensionOf(url) ?? 'unknown';
  }

  const optimized = await pipeline
    .clone()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 5 })
    .toBuffer();

  const optimizedMeta = await sharp(optimized).metadata();

  const placeholderBuf = await pipeline
    .clone()
    .resize({ width: 20, height: 20, fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();

  const ext = extensionOf(url);

  return {
    optimized,
    optimizedContentType: 'image/webp',
    original,
    originalContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    originalFormat: sourceFormat,
    width: optimizedMeta.width ?? 0,
    height: optimizedMeta.height ?? 0,
    placeholder: `data:image/webp;base64,${placeholderBuf.toString('base64')}`,
    bytes: optimized.byteLength,
  };
}

/** `01M2NBE2254STYTNNGJXWBJH09.HEIC` -> `01m2nbe2254stytnngjxwbjh09` */
export function storageKeyFromUrl(url: string): string {
  const file = url.split('/').pop() ?? 'image';
  return file.replace(/\.[^.]+$/, '').toLowerCase();
}
