-- PR B: task recurrence + deadlines.
-- `recurrence` drives how often a task can be completed again:
--   none    -> one-off, completable once ever
--   daily   -> once per calendar day
--   weekly  -> once per ISO week
--   monthly -> once per calendar month
--   custom  -> once per `recurrence_interval_days` days
-- `due_date` is an optional deadline; after it passes an open task can no
-- longer be completed.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Backfill: tasks previously flagged repeatable become daily recurring so their
-- behaviour (completable more than once) is preserved.
UPDATE tasks SET recurrence = 'daily'
  WHERE recurrence = 'none' AND repeatable = true;
