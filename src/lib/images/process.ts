import sharp, { type Sharp } from 'sharp';
// @ts-expect-error - libheif-js ships no type declarations
import libheif from 'libheif-js/wasm-bundle';

/**
 * Image processing shared by the legacy importer and admin photo uploads.
 *
 * One implementation so a photo uploaded today is treated exactly like one
 * migrated from the old site: EXIF orientation applied, resized to a sane
 * delivery size, encoded to WebP, and given a blur-up placeholder.
 *
 * HEIC note: iPhone HEICs (including every one on the legacy site) can carry an
 * item location that overruns the end of the file. sharp's bundled libheif
 * rejects those outright, while libheif's WASM build decodes them correctly, so
 * HEIC is routed through libheif to raw RGBA and handed to sharp from there.
 */

export interface ProcessedImage {
  optimized: Buffer;
  optimizedContentType: 'image/webp';
  original: Buffer;
  originalContentType: string;
  originalFormat: string;
  width: number;
  height: number;
  placeholder: string;
  bytes: number;
}

export interface ProcessOptions {
  /** Longest-edge cap for the delivered image. */
  maxEdge?: number;
  quality?: number;
  /** Used to infer the source type when the bytes are ambiguous. */
  filename?: string;
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

export function extensionOf(nameOrUrl: string): string {
  return (nameOrUrl.split('?')[0].split('.').pop() ?? '').toLowerCase();
}

export function isHeic(buffer: Buffer, nameOrUrl = ''): boolean {
  if (/\.hei[cf]$/i.test(nameOrUrl.split('?')[0])) return true;

  // ISO-BMFF brand check: 'ftyp' at offset 4, then a HEIF brand.
  const brand = buffer.toString('latin1', 8, 12);
  return (
    buffer.toString('latin1', 4, 8) === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)
  );
}

async function decodeHeic(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
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

export async function processImageBuffer(
  original: Buffer,
  { maxEdge = 1600, quality = 82, filename = '' }: ProcessOptions = {},
): Promise<ProcessedImage> {
  let pipeline: Sharp;
  let sourceFormat: string;

  if (isHeic(original, filename)) {
    const raw = await decodeHeic(original);
    pipeline = sharp(raw.data, {
      raw: { width: raw.width, height: raw.height, channels: 4 },
    });
    sourceFormat = 'heic';
  } else {
    // .rotate() with no argument applies the EXIF orientation tag and clears it,
    // which phone photos almost always need.
    pipeline = sharp(original, { failOn: 'none' }).rotate();
    sourceFormat = (await pipeline.metadata()).format ?? extensionOf(filename) ?? 'unknown';
  }

  const optimized = await pipeline
    .clone()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toBuffer();

  const optimizedMeta = await sharp(optimized).metadata();

  const placeholderBuf = await pipeline
    .clone()
    .resize({ width: 20, height: 20, fit: 'inside' })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    optimized,
    optimizedContentType: 'image/webp',
    original,
    originalContentType: CONTENT_TYPES[extensionOf(filename)] ?? 'application/octet-stream',
    originalFormat: sourceFormat,
    width: optimizedMeta.width ?? 0,
    height: optimizedMeta.height ?? 0,
    placeholder: `data:image/webp;base64,${placeholderBuf.toString('base64')}`,
    bytes: optimized.byteLength,
  };
}
