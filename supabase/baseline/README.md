# Production baseline

`20260926_production_baseline.sql` records the already-existing Dobob-owned
Production schema as the starting point for ordered migrations.

It is deliberately comment-only. Do not execute it in Production and do not
mark it as a newly applied schema change. It exists to establish migration
history without replaying `schema.sql` against the live database.

## Scope

- `schema.sql` remains the canonical bootstrap for a new environment.
- Production changes after this baseline belong in `../migrations/`.
- Historical one-off SQL belongs in `../legacy/` and must not be replayed.
- `hq_app_logs`, `hq_meetings`, and their dependent objects are managed by a
  separate feature and are outside Dobob migration ownership.

## Known baseline differences

- Production does not have the two `meal_mission_items` tag CHECK constraints
  currently present in the bootstrap schema.
- Production does not publish `menu_template_items` through Realtime.
- These differences are intentional at the baseline point. Do not reconcile
  them by running the full bootstrap or a legacy patch.

## Promotion rule

Every new migration must be reviewed, applied to Production explicitly, and
verified before the next migration is started. Never run all migrations as an
unreviewed batch against the existing Production database.
