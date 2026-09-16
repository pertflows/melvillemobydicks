import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Polite, cached HTTP for the legacy crawl.
 *
 * Responses are cached on disk so re-running the importer (or iterating on the
 * parsers) does not hammer the live site. Pass `force` to bypass.
 */

const CACHE_DIR = path.join(process.cwd(), '.cache', 'legacy');

function cachePath(url: string, ext: string) {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `${hash}${ext}`);
}

async function readCache(file: string): Promise<Buffer | null> {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

export interface FetchOptions {
  force?: boolean;
  /** Milliseconds to wait after a network hit, to stay polite. */
  delayMs?: number;
}

let lastNetworkHit = 0;

async function throttle(delayMs: number) {
  const since = Date.now() - lastNetworkHit;
  if (since < delayMs) {
    await new Promise((r) => setTimeout(r, delayMs - since));
  }
  lastNetworkHit = Date.now();
}

async function fetchBuffer(
  url: string,
  ext: string,
  { force = false, delayMs = 150 }: FetchOptions = {},
): Promise<Buffer> {
  const file = cachePath(url, ext);

  if (!force) {
    const cached = await readCache(file);
    if (cached) return cached;
  }

  await throttle(delayMs);

  const res = await fetch(url, {
    headers: {
      // Identify the crawler honestly. This is our own site.
      'user-agent': 'MobyDicksImporter/1.0 (+https://mobydicks.org migration)',
      accept: '*/*',
    },
  });

  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status} ${res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, buf);
  return buf;
}

export async function fetchText(url: string, opts?: FetchOptions): Promise<string> {
  return (await fetchBuffer(url, '.html', opts)).toString('utf8');
}

export async function fetchBinary(url: string, opts?: FetchOptions): Promise<Buffer> {
  return fetchBuffer(url, '.bin', opts);
}

/** Probes a URL, returning null on 404 rather than throwing. */
export async function fetchTextOrNull(
  url: string,
  opts?: FetchOptions,
): Promise<string | null> {
  try {
    return await fetchText(url, opts);
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return null;
    throw err;
  }
}
