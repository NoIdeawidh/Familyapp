-- PR E: track whether the setup wizard has been completed for a family.
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;

-- Existing families already have data, so consider them onboarded.
UPDATE families SET onboarded = true
  WHERE id IN (SELECT DISTINCT family_id FROM tasks)
     OR id IN (SELECT DISTINCT family_id FROM rewards);
