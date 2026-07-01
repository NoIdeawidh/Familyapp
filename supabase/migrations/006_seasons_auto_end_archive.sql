-- PR C: automatic season end + archived-season browsing.
--  * Season length is configured in WEEKS (default 4) per family (P9).
--  * When a season's end_date passes it is auto-archived; its final standings
--    are snapshotted so they survive the season_victory_points reset (P4).
--  * Season lifecycle is done via SECURITY DEFINER RPCs so the snapshot write
--    and archive happen atomically regardless of the caller's row-level rights.

-- 1. Season length in weeks (keep old months column for backward compatibility).
ALTER TABLE family_rules
  ADD COLUMN IF NOT EXISTS season_length_weeks INTEGER NOT NULL DEFAULT 4;

UPDATE family_rules
  SET season_length_weeks = GREATEST(1, season_length_months * 4)
  WHERE season_length_weeks = 4 AND season_length_months <> 1;

-- 2. Final standings snapshot per season.
CREATE TABLE IF NOT EXISTS season_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  member_avatar TEXT NOT NULL DEFAULT '🧭',
  rank INTEGER NOT NULL,
  victory_points INTEGER NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  underlings_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_season_results_season ON season_results(season_id);

ALTER TABLE season_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS season_results_select ON season_results;
CREATE POLICY season_results_select ON season_results FOR SELECT
  USING (family_id = get_user_family_id());

-- 3. Snapshot helper: freezes the standings of a season into season_results.
CREATE OR REPLACE FUNCTION snapshot_season(p_season_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO season_results (
    season_id, family_id, member_id, member_name, member_avatar,
    rank, victory_points, tasks_completed, underlings_earned
  )
  SELECT
    p_season_id,
    s.family_id,
    fm.id,
    fm.name,
    fm.avatar,
    RANK() OVER (ORDER BY fm.season_victory_points DESC),
    fm.season_victory_points,
    COALESCE(tc.cnt, 0),
    COALESCE(tc.earned, 0)
  FROM seasons s
  JOIN family_members fm
    ON fm.family_id = s.family_id AND fm.active AND fm.role <> 'admin'
  LEFT JOIN (
    SELECT c.member_id, COUNT(*) AS cnt, SUM(t.value_in_underlings) AS earned
    FROM task_completions c
    JOIN tasks t ON t.id = c.task_id
    WHERE c.season_id = p_season_id AND c.approved
    GROUP BY c.member_id
  ) tc ON tc.member_id = fm.id
  WHERE s.id = p_season_id
  ON CONFLICT (season_id, member_id) DO NOTHING;
END;
$$;

-- 4. Auto-archive an expired active season. Callable by any family member so a
--    plain page load can trigger the time-based transition. Returns true if a
--    season was archived.
CREATE OR REPLACE FUNCTION archive_expired_season(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season UUID;
BEGIN
  IF p_family_id IS DISTINCT FROM get_user_family_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_season
  FROM seasons
  WHERE family_id = p_family_id AND active AND end_date < now()
  LIMIT 1;

  IF v_season IS NULL THEN
    RETURN false;
  END IF;

  PERFORM snapshot_season(v_season);
  UPDATE seasons SET active = false, archived = true WHERE id = v_season;
  RETURN true;
END;
$$;

-- 5. Start a new season (ends+snapshots the current one, resets season points).
--    Requires the manage_seasons permission.
CREATE OR REPLACE FUNCTION start_new_season(p_family_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active UUID;
  v_weeks INTEGER;
  v_count INTEGER;
  v_new UUID;
BEGIN
  IF p_family_id IS DISTINCT FROM get_user_family_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT has_permission('manage_seasons') THEN
    RAISE EXCEPTION 'forbidden: manage_seasons required';
  END IF;

  SELECT id INTO v_active FROM seasons WHERE family_id = p_family_id AND active LIMIT 1;
  IF v_active IS NOT NULL THEN
    PERFORM snapshot_season(v_active);
    UPDATE seasons SET active = false, archived = true WHERE id = v_active;
  END IF;

  UPDATE family_members SET season_victory_points = 0 WHERE family_id = p_family_id;

  SELECT COALESCE(season_length_weeks, 4) INTO v_weeks FROM family_rules WHERE family_id = p_family_id;
  v_weeks := COALESCE(v_weeks, 4);
  SELECT COUNT(*) INTO v_count FROM seasons WHERE family_id = p_family_id;

  INSERT INTO seasons (family_id, name, start_date, end_date, active)
  VALUES (
    p_family_id,
    'Saison ' || (v_count + 1),
    now(),
    now() + (v_weeks * INTERVAL '7 days'),
    true
  )
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;
