-- FamilyApp: Initial Database Schema
-- Supabase (PostgreSQL) with Row-Level Security

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

-- Families
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settings JSONB NOT NULL DEFAULT '{}'
);

-- Family members (linked to Supabase Auth)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'parent', 'player')),
  avatar TEXT NOT NULL DEFAULT '🧭',
  auth_email TEXT,
  pin_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  gold INTEGER NOT NULL DEFAULT 0,
  building_material INTEGER NOT NULL DEFAULT 0,
  underlings INTEGER NOT NULL DEFAULT 0,
  total_victory_points INTEGER NOT NULL DEFAULT 0,
  season_victory_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Granular permissions per member
CREATE TABLE member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(member_id, permission)
);

-- Invite codes for joining a family
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin', 'parent', 'player')),
  created_by UUID NOT NULL REFERENCES family_members(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES family_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'open' CHECK (type IN ('private', 'open')),
  assigned_to UUID REFERENCES family_members(id) ON DELETE SET NULL,
  value_in_underlings INTEGER NOT NULL DEFAULT 1,
  needs_approval BOOLEAN NOT NULL DEFAULT false,
  repeatable BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'done')),
  category TEXT NOT NULL DEFAULT 'Allgemein',
  created_by UUID NOT NULL REFERENCES family_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task completions (history, separate from tasks)
CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id),
  season_id UUID NOT NULL REFERENCES seasons(id),
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES family_members(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fields (map tiles per season)
CREATE TABLE fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  grid_position TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'Bezirk',
  owner_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  adjacent_positions TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'owned', 'contested', 'secured')),
  production_type TEXT NOT NULL DEFAULT 'gold' CHECK (production_type IN ('gold', 'buildingMaterial')),
  production_value INTEGER NOT NULL DEFAULT 1,
  siege_status TEXT NOT NULL DEFAULT 'none' CHECK (siege_status IN ('none', 'sieged', 'secured')),
  last_collected_season_id UUID REFERENCES seasons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, season_id, grid_position)
);

-- Rewards
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost_in_gold INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'special-right' CHECK (type IN ('special-right', 'cosmetic', 'family-benefit', 'game-boost')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reward redemptions
CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES family_members(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Family rules (one per family)
CREATE TABLE family_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  field_claim_cost INTEGER NOT NULL DEFAULT 1,
  takeover_cost INTEGER NOT NULL DEFAULT 2,
  season_length_months INTEGER NOT NULL DEFAULT 2,
  UNIQUE(family_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_auth ON family_members(auth_user_id);
CREATE INDEX idx_tasks_family ON tasks(family_id);
CREATE INDEX idx_task_completions_task ON task_completions(task_id);
CREATE INDEX idx_task_completions_member ON task_completions(member_id);
CREATE INDEX idx_fields_family_season ON fields(family_id, season_id);
CREATE INDEX idx_rewards_family ON rewards(family_id);
CREATE INDEX idx_seasons_family ON seasons(family_id);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_family ON invite_codes(family_id);
CREATE INDEX idx_member_permissions_member ON member_permissions(member_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get the family_id for the currently authenticated user
CREATE OR REPLACE FUNCTION get_user_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM family_members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin of their family
CREATE OR REPLACE FUNCTION is_family_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE auth_user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(perm TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_permissions mp
    JOIN family_members fm ON fm.id = mp.member_id
    WHERE fm.auth_user_id = auth.uid()
    AND mp.permission = perm
    AND mp.granted = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Generate a random invite code (6 chars alphanumeric uppercase)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
$$ LANGUAGE sql VOLATILE;

-- Verify PIN for a player member (constant-time comparison)
CREATE OR REPLACE FUNCTION verify_member_pin(p_member_id UUID, p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash
  FROM family_members WHERE id = p_member_id;
  IF stored_hash IS NULL THEN RETURN false; END IF;
  RETURN stored_hash = crypt(p_pin, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Hash a PIN
CREATE OR REPLACE FUNCTION hash_pin(p_pin TEXT)
RETURNS TEXT AS $$
  SELECT crypt(p_pin, gen_salt('bf'));
$$ LANGUAGE sql VOLATILE;

-- Return safe login profiles for a family (for the "select character" screen).
-- Exposes only non-sensitive fields, callable before authentication.
CREATE OR REPLACE FUNCTION get_login_profiles(p_family_id UUID)
RETURNS TABLE (id UUID, name TEXT, avatar TEXT, role TEXT, uses_pin BOOLEAN) AS $$
  SELECT
    fm.id,
    fm.name,
    fm.avatar,
    fm.role,
    (fm.role = 'player') AS uses_pin
  FROM family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.active = true
  ORDER BY fm.created_at;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Look up a family id + name from a member's login (used to remember device family)
CREATE OR REPLACE FUNCTION get_family_summary(p_family_id UUID)
RETURNS TABLE (id UUID, name TEXT) AS $$
  SELECT id, name FROM families WHERE id = p_family_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Default permissions per role. Kept in sync with src/lib/permissions.ts.
CREATE OR REPLACE FUNCTION role_default_permissions(p_role TEXT)
RETURNS TEXT[] AS $$
  SELECT CASE p_role
    WHEN 'admin' THEN ARRAY[
      'view_own_tasks','complete_own_tasks','create_tasks','edit_tasks','delete_tasks','approve_tasks',
      'buy_rewards','create_rewards','edit_rewards','delete_rewards',
      'view_map','claim_fields','manage_map',
      'view_own_stats','view_leaderboard','manage_seasons',
      'manage_members','invite_members','manage_permissions','reset_pins',
      'access_admin','manage_rules','adjust_resources'
    ]
    WHEN 'parent' THEN ARRAY[
      'view_own_tasks','complete_own_tasks','create_tasks','edit_tasks','approve_tasks',
      'buy_rewards','create_rewards','edit_rewards',
      'view_map','claim_fields','view_own_stats','view_leaderboard',
      'manage_seasons','manage_members','invite_members','reset_pins',
      'access_admin','adjust_resources'
    ]
    ELSE ARRAY[
      'view_own_tasks','complete_own_tasks','buy_rewards',
      'view_map','claim_fields','view_own_stats','view_leaderboard'
    ]
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Atomically redeem an invite code and create the member for the current auth
-- user. SECURITY DEFINER so a joining user (no family yet) cannot insert into
-- arbitrary families directly; the only way to join is with a valid code.
CREATE OR REPLACE FUNCTION redeem_invite(p_code TEXT, p_name TEXT, p_avatar TEXT)
RETURNS UUID AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_member_id UUID;
  v_perm TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_invite FROM invite_codes
    WHERE code = upper(p_code) AND used_at IS NULL AND expires_at > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF EXISTS (SELECT 1 FROM family_members WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO family_members (family_id, auth_user_id, name, role, avatar, auth_email)
    VALUES (
      v_invite.family_id, auth.uid(), p_name, v_invite.role, p_avatar,
      (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    RETURNING id INTO v_member_id;

  FOREACH v_perm IN ARRAY role_default_permissions(v_invite.role) LOOP
    INSERT INTO member_permissions (member_id, permission, granted)
      VALUES (v_member_id, v_perm, true);
  END LOOP;

  UPDATE invite_codes SET used_at = now(), used_by = v_member_id WHERE id = v_invite.id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_rules ENABLE ROW LEVEL SECURITY;

-- Families: members can view their own family
CREATE POLICY families_select ON families FOR SELECT
  USING (id = get_user_family_id());

CREATE POLICY families_insert ON families FOR INSERT
  WITH CHECK (true); -- anyone can create a family (during signup)

CREATE POLICY families_update ON families FOR UPDATE
  USING (id = get_user_family_id() AND is_family_admin());

-- Family Members: view members of own family
CREATE POLICY members_select ON family_members FOR SELECT
  USING (family_id = get_user_family_id());

-- Only the family-creation bootstrap is allowed via direct insert: a user with
-- no family yet may insert themselves as that family's admin. All other joins
-- must go through the redeem_invite() SECURITY DEFINER function.
CREATE POLICY members_insert ON family_members FOR INSERT
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = 'admin'
    AND get_user_family_id() IS NULL
  );

CREATE POLICY members_update ON family_members FOR UPDATE
  USING (family_id = get_user_family_id());

CREATE POLICY members_delete ON family_members FOR DELETE
  USING (family_id = get_user_family_id() AND is_family_admin());

-- Permissions: view own family's permissions
CREATE POLICY permissions_select ON member_permissions FOR SELECT
  USING (member_id IN (SELECT id FROM family_members WHERE family_id = get_user_family_id()));

CREATE POLICY permissions_manage ON member_permissions FOR ALL
  USING (member_id IN (SELECT id FROM family_members WHERE family_id = get_user_family_id()) AND is_family_admin());

-- Invite codes: manage own family's codes
CREATE POLICY invite_codes_select ON invite_codes FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY invite_codes_insert ON invite_codes FOR INSERT
  WITH CHECK (family_id = get_user_family_id());

-- Allow anyone to look up a code (for joining)
CREATE POLICY invite_codes_lookup ON invite_codes FOR SELECT
  USING (used_at IS NULL AND expires_at > now());

CREATE POLICY invite_codes_update ON invite_codes FOR UPDATE
  USING (true); -- needed for marking as used during join

-- Seasons: own family only
CREATE POLICY seasons_select ON seasons FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY seasons_manage ON seasons FOR ALL
  USING (family_id = get_user_family_id());

-- Tasks: own family only
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY tasks_manage ON tasks FOR ALL
  USING (family_id = get_user_family_id());

-- Task completions: own family's tasks
CREATE POLICY completions_select ON task_completions FOR SELECT
  USING (task_id IN (SELECT id FROM tasks WHERE family_id = get_user_family_id()));

CREATE POLICY completions_manage ON task_completions FOR ALL
  USING (task_id IN (SELECT id FROM tasks WHERE family_id = get_user_family_id()));

-- Fields: own family only
CREATE POLICY fields_select ON fields FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY fields_manage ON fields FOR ALL
  USING (family_id = get_user_family_id());

-- Rewards: own family only
CREATE POLICY rewards_select ON rewards FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY rewards_manage ON rewards FOR ALL
  USING (family_id = get_user_family_id());

-- Reward redemptions
CREATE POLICY redemptions_select ON reward_redemptions FOR SELECT
  USING (reward_id IN (SELECT id FROM rewards WHERE family_id = get_user_family_id()));

CREATE POLICY redemptions_manage ON reward_redemptions FOR ALL
  USING (reward_id IN (SELECT id FROM rewards WHERE family_id = get_user_family_id()));

-- Family rules: own family only
CREATE POLICY rules_select ON family_rules FOR SELECT
  USING (family_id = get_user_family_id());

CREATE POLICY rules_manage ON family_rules FOR ALL
  USING (family_id = get_user_family_id());

-- ============================================================
-- ENABLE pgcrypto (needed for PIN hashing)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
