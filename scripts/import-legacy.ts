#!/usr/bin/env tsx
/**
 * Legacy site importer.
 *
 * Crawls the previous mobydicks.org, normalises what it published, and loads it
 * into the new database and storage buckets.
 *
 *   npx tsx scripts/import-legacy.ts crawl     # fetch + parse -> JSON snapshot
 *   npx tsx scripts/import-legacy.ts load      # snapshot -> database + storage
 *   npx tsx scripts/import-legacy.ts verify    # compare the DB against the source
 *   npx tsx scripts/import-legacy.ts all       # crawl, load, verify
 *
 * Flags:
 *   --force        ignore the on-disk HTTP cache and refetch
 *   --skip-media   database rows only, no image download/convert/upload
 *   --out <path>   snapshot location (default .cache/legacy-snapshot.json)
 *
 * The import is idempotent: everything is keyed on legacy_id, so re-running
 * reconciles instead of duplicating.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';
import { crawlLegacySite } from '../src/lib/legacy/crawl';
import { loadSnapshot } from '../src/lib/legacy/load';
import { verifyImport } from '../src/lib/legacy/verify';
import type { LegacySnapshot } from '../src/lib/legacy/types';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'all';
const force = args.includes('--force');
const skipMedia = args.includes('--skip-media');
const outPath =
  args[args.indexOf('--out') + 1] && args.includes('--out')
    ? args[args.indexOf('--out') + 1]
    : path.join('.cache', 'legacy-snapshot.json');

const BASE_URL = process.env.LEGACY_BASE_URL ?? 'https://mobydicks.org';

const log = (m: string) => console.log(m);
const step = (m: string) => console.log(`\n\x1b[1m${m}\x1b[0m`);

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error(
      '\nMissing Supabase credentials.\n' +
        '  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.\n' +
        '  The secret (service_role) key is required because the importer writes to\n' +
        '  tables and buckets that row level security reserves for admins.\n' +
        '  Find it at: Dashboard > Project Settings > API keys > service_role\n',
    );
    process.exit(1);
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function doCrawl(): Promise<LegacySnapshot> {
  step(`Crawling ${BASE_URL}`);
  const snapshot = await crawlLegacySite({ baseUrl: BASE_URL, force, onProgress: log });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2));
  log(`\nSnapshot written to ${outPath}`);
  return snapshot;
}

async function readSnapshot(): Promise<LegacySnapshot> {
  try {
    return JSON.parse(await readFile(outPath, 'utf8')) as LegacySnapshot;
  } catch {
    log(`No snapshot at ${outPath}; crawling first.`);
    return doCrawl();
  }
}

async function main() {
  if (command === 'crawl') {
    await doCrawl();
    return;
  }

  if (command === 'load' || command === 'all') {
    const snapshot = command === 'all' ? await doCrawl() : await readSnapshot();

    step('Loading into Supabase');
    const report = await loadSnapshot({ db: db(), snapshot, skipMedia, onProgress: log });

    step('Import summary');
    for (const [key, value] of Object.entries(report)) {
      if (key === 'warnings') continue;
      log(`  ${key.padEnd(18)} ${value}`);
    }

    if (report.warnings.length) {
      step(`Warnings (${report.warnings.length})`);
      for (const w of report.warnings) log(`  - ${w}`);
    }
  }

  if (command === 'verify' || command === 'all') {
    step('Verifying against the source');
    const snapshot = await readSnapshot();
    const ok = await verifyImport({ db: db(), snapshot, skipMedia, onProgress: log });
    if (!ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nImport failed:', err);
  process.exit(1);
});
