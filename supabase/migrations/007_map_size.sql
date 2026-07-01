-- PR D: configurable map size per family (number of hex fields per season).
ALTER TABLE family_rules
  ADD COLUMN IF NOT EXISTS map_size INTEGER NOT NULL DEFAULT 19;
