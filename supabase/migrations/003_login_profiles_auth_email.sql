-- PIN login happens before the user is authenticated, so the client cannot read
-- family_members under RLS to discover the synthetic login email. Expose that
-- email through the existing SECURITY DEFINER login-profiles RPC, but only for
-- PIN-based player profiles, so real parent/admin emails are never leaked.
DROP FUNCTION IF EXISTS get_login_profiles(UUID);

CREATE OR REPLACE FUNCTION get_login_profiles(p_family_id UUID)
RETURNS TABLE (id UUID, name TEXT, avatar TEXT, role TEXT, uses_pin BOOLEAN, auth_email TEXT) AS
$$
  SELECT
    fm.id,
    fm.name,
    fm.avatar,
    fm.role,
    (fm.role = 'player') AS uses_pin,
    CASE WHEN fm.role = 'player' THEN fm.auth_email ELSE NULL END AS auth_email
  FROM family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.active = true
  ORDER BY fm.created_at;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
