import { fetchBinary } from './fetch';
import {
  processImageBuffer,
  type ProcessedImage,
  type ProcessOptions as BaseOptions,
} from '../images/process';

/**
 * Downloads a legacy image and runs it through the shared processing pipeline.
 * The originals are kept byte-for-byte; only the delivered copy is re-encoded.
 */

export type { ProcessedImage };
export { extensionOf } from '../images/process';

export interface ProcessOptions extends BaseOptions {
  force?: boolean;
}

export async function processImage(
  url: string,
  { force, ...options }: ProcessOptions = {},
): Promise<ProcessedImage> {
  const original = await fetchBinary(url, { force });
  return processImageBuffer(original, { ...options, filename: url });
}

/** `01M2NBE2254STYTNNGJXWBJH09.HEIC` -> `01m2nbe2254stytnngjxwbjh09` */
export function storageKeyFromUrl(url: string): string {
  const file = url.split('/').pop() ?? 'image';
  return file.replace(/\.[^.]+$/, '').toLowerCase();
}
