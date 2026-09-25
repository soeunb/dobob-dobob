# Legacy SQL

These files are historical one-off patches. They are preserved unchanged for
reference, but they are not an ordered migration history and must not be
replayed against Production or a new environment.

Use `../schema.sql` to bootstrap a new environment. Use only reviewed,
ordered files in `../migrations/` for changes after the Production baseline.

In particular, the Realtime publication statement in
`menu-template-items.sql` is historical and is not part of the current
Production design.
