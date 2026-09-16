import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';
import type { LegacySnapshot } from './types';

/**
 * Post-import verification.
 *
 * Reads the migrated data back out of the database and compares it field by
 * field against what the legacy site published. This is the check that the
 * migration was faithful - not that it merely ran without throwing.
 */

export interface VerifyOptions {
  db: SupabaseClient<Database>;
  snapshot: LegacySnapshot;
  /** Set when the import ran with --skip-media, so photos are not expected. */
  skipMedia?: boolean;
  onProgress?: (message: string) => void;
}

export async function verifyImport({
  db,
  snapshot,
  skipMedia = false,
  onProgress = () => {},
}: VerifyOptions): Promise<boolean> {
  const failures: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) failures.push(message);
  };

  // -- roster, jersey numbers, positions and every published stat -----------
  const { data: players, error } = await db
    .from('players')
    .select(
      'id, display_name, bio, photo_path, legacy_id, legacy_position_label, player_seasons(jersey_number), legacy_stat_baselines(*)',
    );
  if (error) throw new Error(`verify players: ${error.message}`);

  const byLegacy = new Map(players.map((p) => [p.legacy_id, p]));

  for (const src of snapshot.players) {
    const got = byLegacy.get(src.legacyId);
    if (!got) {
      failures.push(`MISSING player ${src.displayName}`);
      continue;
    }

    check(got.display_name === src.displayName, `${src.displayName}: name mismatch`);
    check(
      got.player_seasons[0]?.jersey_number === src.jerseyNumber,
      `${src.displayName}: jersey ${got.player_seasons[0]?.jersey_number} != ${src.jerseyNumber}`,
    );
    check(
      got.legacy_position_label === src.positionLabel,
      `${src.displayName}: position "${got.legacy_position_label}" != "${src.positionLabel}"`,
    );

    // Biography must be carried across intact, not summarised or rewritten.
    const expectedBio = src.bioParagraphs.join('\n\n') || null;
    check(got.bio === expectedBio, `${src.displayName}: biography does not match the source`);

    check(
      skipMedia || Boolean(got.photo_path) === Boolean(src.photoUrl),
      `${src.displayName}: photo presence mismatch (has photo: ${Boolean(got.photo_path)}, source: ${Boolean(src.photoUrl)})`,
    );

    const base = got.legacy_stat_baselines[0];
    const s = src.stats;
    if (!base) {
      const anyStat = [s.games, s.hits, s.homeRuns, s.walks, s.rbi].some((v) => v !== null);
      check(!anyStat, `${src.displayName}: legacy stat baseline missing`);
    } else {
      check(base.games === s.games, `${src.displayName}: G ${base.games} != ${s.games}`);
      check(base.hits === s.hits, `${src.displayName}: H ${base.hits} != ${s.hits}`);
      check(base.home_runs === s.homeRuns, `${src.displayName}: HR ${base.home_runs} != ${s.homeRuns}`);
      check(base.rbi === s.rbi, `${src.displayName}: RBI ${base.rbi} != ${s.rbi}`);
      check(base.walks === s.walks, `${src.displayName}: BB ${base.walks} != ${s.walks}`);

      const avg = base.batting_average_override === null ? null : Number(base.batting_average_override);
      const srcAvg = s.battingAverage;
      check(
        avg === null ? srcAvg === null : srcAvg !== null && Math.abs(avg - srcAvg) < 0.0005,
        `${src.displayName}: AVG ${avg} != ${srcAvg}`,
      );

      // The whole point of the baseline table: unknowns stay unknown.
      check(
        base.at_bats === null && base.plate_appearances === null,
        `${src.displayName}: at-bats/PA were fabricated; they must stay NULL`,
      );
    }
  }
  onProgress(`  players checked: ${snapshot.players.length}`);

  // -- games, scores and results -------------------------------------------
  const { data: games, error: gErr } = await db
    .from('games')
    .select('legacy_id, starts_at, status, our_runs_recorded, their_runs_recorded, opponents(name), venues(display_name)');
  if (gErr) throw new Error(`verify games: ${gErr.message}`);

  const gamesByLegacy = new Map(games.map((g) => [g.legacy_id, g]));

  for (const src of snapshot.games) {
    if (!src.startsAt) continue;
    const got = gamesByLegacy.get(src.legacyId);
    if (!got) {
      failures.push(`MISSING game ${src.legacyId}`);
      continue;
    }
    check(
      new Date(got.starts_at).toISOString() === src.startsAt,
      `${src.legacyId}: start time ${got.starts_at} != ${src.startsAt}`,
    );
    check(got.opponents?.name === src.opponentName, `${src.legacyId}: opponent mismatch`);
    check(got.venues?.display_name === src.venueName, `${src.legacyId}: venue mismatch`);
    // Two legacy games publish a score that contradicts their own result
    // label; the importer stores those transposed to agree with the label.
    const contradicts =
      src.ourRuns !== null && src.theirRuns !== null && src.result !== null &&
      src.ourRuns !== src.theirRuns &&
      (src.ourRuns > src.theirRuns ? 'Win' : 'Loss') !== src.result;
    const expectedOurs = contradicts ? src.theirRuns : src.ourRuns;
    const expectedTheirs = contradicts ? src.ourRuns : src.theirRuns;

    check(got.our_runs_recorded === expectedOurs, `${src.legacyId}: our runs ${got.our_runs_recorded} != ${expectedOurs}`);
    check(got.their_runs_recorded === expectedTheirs, `${src.legacyId}: their runs ${got.their_runs_recorded} != ${expectedTheirs}`);
  }
  onProgress(`  games checked: ${snapshot.games.filter((g) => g.startsAt).length}`);

  // -- the team record the old site advertised -----------------------------
  const { data: record } = await db.from('team_season_record').select('*');
  const wins = snapshot.games.filter((g) => g.result === 'Win').length;
  const losses = snapshot.games.filter((g) => g.result === 'Loss').length;
  const totals = (record ?? []).reduce(
    (acc, r) => ({ wins: acc.wins + (r.wins ?? 0), losses: acc.losses + (r.losses ?? 0) }),
    { wins: 0, losses: 0 },
  );
  check(
    totals.wins === wins && totals.losses === losses,
    `team record ${totals.wins}-${totals.losses} != source ${wins}-${losses}`,
  );
  onProgress(`  record: ${totals.wins}-${totals.losses} (source ${wins}-${losses})`);

  // -- editorial content ----------------------------------------------------
  const { data: posts } = await db.from('captains_log_posts').select('legacy_id, title, body, game_id');
  const postsByLegacy = new Map((posts ?? []).map((p) => [p.legacy_id, p]));

  for (const src of snapshot.posts) {
    const got = postsByLegacy.get(src.legacyId);
    if (!got) {
      failures.push(`MISSING post ${src.legacyId}`);
      continue;
    }
    check(got.title === src.title, `${src.legacyId}: title mismatch`);
    check(
      got.body === src.bodyParagraphs.join('\n\n'),
      `${src.legacyId}: body does not match the source`,
    );
  }
  const linked = (posts ?? []).filter((p) => p.game_id).length;
  onProgress(`  posts checked: ${snapshot.posts.length} (${linked} linked to a game)`);

  // -- awards ---------------------------------------------------------------
  const { count: awardCount } = await db
    .from('player_awards')
    .select('*', { count: 'exact', head: true })
    .eq('award_code', 'potg');
  const srcAwards = snapshot.games.filter((g) => g.potgPlayerName).length;
  check(
    (awardCount ?? 0) === srcAwards,
    `Player of the Game awards ${awardCount} != source ${srcAwards}`,
  );
  onProgress(`  awards checked: ${awardCount} of ${srcAwards}`);

  if (failures.length) {
    console.log(`\n\x1b[31m${failures.length} verification failure(s):\x1b[0m`);
    for (const f of failures) console.log(`  ✗ ${f}`);
    return false;
  }

  console.log('\n\x1b[32mVerified: every field matches the legacy source.\x1b[0m');
  return true;
}
