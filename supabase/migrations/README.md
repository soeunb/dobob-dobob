# Ordered migrations

This directory is reserved for changes after the 2026-09-26 Production
baseline. Add and apply one migration at a time in this order:

1. Author integrity
2. `meal_mission_items` tag CHECK constraints
3. Atomic meal write RPC
4. Atomic template write RPC
5. Meal date query index and date-range reads

Each migration requires its own review, Production application, and functional
verification before work starts on the next migration. Baseline and legacy SQL
files are never executed as part of this sequence.
