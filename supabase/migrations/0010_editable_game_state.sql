-- Correcting the inning and the outs from the scoreboard.
--
-- Both are replayed from the play log, so they can only be wrong when the log
-- is incomplete: a missed out, an inning that turned over while nobody was
-- looking at the phone. Rather than let a correction rewrite plays that did
-- happen, it is stored as an override anchored to a point in the log.
--
-- The anchor is the sequence number of the last recorded appearance at the
-- moment of the correction. Replay applies the override once everything up to
-- that point has been replayed, and appearances recorded afterwards carry on
-- from the corrected state. Undoing back past the anchor leaves the override in
-- place, which is what a scorekeeper means by "we are in the 5th".

alter table public.games
  add column state_override_after_seq integer
    check (state_override_after_seq >= 0),
  add column state_override_inning smallint
    check (state_override_inning >= 1),
  -- Three outs is not a state to sit in: it ends the half. Retiring the side is
  -- the inning stepper's job, so this holds 0, 1 or 2.
  add column state_override_outs smallint
    check (state_override_outs between 0 and 2);

alter table public.games
  add constraint games_state_override_anchored check (
    (state_override_after_seq is null)
    = (state_override_inning is null and state_override_outs is null)
  );

comment on column public.games.state_override_after_seq is
  'Sequence the inning/outs override applies from; null when nothing is overridden.';
comment on column public.games.state_override_inning is
  'Hand-set current inning, overriding the one replayed from the log.';
comment on column public.games.state_override_outs is
  'Hand-set current outs, overriding the count replayed from the log.';
