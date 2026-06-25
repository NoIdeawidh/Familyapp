-- ============================================================
-- Role redefinition: admin = pure manager, parent = player+manager via PIN
-- ============================================================
-- Two product decisions drive this migration:
--  1. The admin is a pure administrator and does NOT take part in the game:
--     no resources, no victory points, no completing tasks / buying rewards /
--     claiming fields. The admin keeps full management rights (incl. viewing
--     the map for oversight) but loses all "play" permissions.
--  2. Parents are normal players with extra management rights, but they must
--     NOT see the dedicated admin area. They manage tasks/rewards/seasons
--     through the regular top-level pages, gated by their permissions.
-- Parents (and players) log in with a PIN, so only the admin uses e-mail.

CREATE OR REPLACE FUNCTION role_default_permissions(p_role TEXT)
RETURNS TEXT[] AS $$
  SELECT CASE p_role
    -- Pure manager: every management right, no play rights. Keeps view_own_tasks
    -- (to open the tasks page in management mode) and view_map for oversight.
    WHEN 'admin' THEN ARRAY[
      'view_own_tasks','create_tasks','edit_tasks','delete_tasks','approve_tasks',
      'create_rewards','edit_rewards','delete_rewards',
      'view_map','manage_map',
      'view_leaderboard','manage_seasons',
      'manage_members','invite_members','manage_permissions','reset_pins',
      'access_admin','manage_rules','adjust_resources'
    ]
    -- Player with management rights for tasks, rewards and seasons. No access to
    -- the admin area (no manage_members/permissions/rules/resources/invite).
    WHEN 'parent' THEN ARRAY[
      'view_own_tasks','complete_own_tasks','create_tasks','edit_tasks','delete_tasks','approve_tasks',
      'buy_rewards','create_rewards','edit_rewards','delete_rewards',
      'view_map','claim_fields','view_own_stats','view_leaderboard',
      'manage_seasons'
    ]
    ELSE ARRAY[
      'view_own_tasks','complete_own_tasks','buy_rewards',
      'view_map','claim_fields','view_own_stats','view_leaderboard'
    ]
  END;
$$ LANGUAGE sql IMMUTABLE;

-- PIN login is available to every non-admin member (players and parents). Only
-- the admin authenticates with a real e-mail/password, so the admin's e-mail is
-- never exposed through this pre-auth RPC.
DROP FUNCTION IF EXISTS get_login_profiles(UUID);

CREATE OR REPLACE FUNCTION get_login_profiles(p_family_id UUID)
RETURNS TABLE (id UUID, name TEXT, avatar TEXT, role TEXT, uses_pin BOOLEAN, auth_email TEXT) AS
$$
  SELECT
    fm.id,
    fm.name,
    fm.avatar,
    fm.role,
    (fm.role <> 'admin') AS uses_pin,
    CASE WHEN fm.role <> 'admin' THEN fm.auth_email ELSE NULL END AS auth_email
  FROM family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.active = true
  ORDER BY fm.created_at;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
