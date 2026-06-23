-- ============================================================
-- create_family RPC
-- ============================================================
-- Bootstraps a new family for the currently authenticated user and makes them
-- its admin, atomically. SECURITY DEFINER so it bypasses RLS during bootstrap.
--
-- This replaces the previous client-side sequence of inserts. That sequence
-- failed under RLS: `INSERT INTO families ... RETURNING *` is checked against
-- the families SELECT policy (`id = get_user_family_id()`), which is false for
-- a user who is not a member of any family yet (chicken-and-egg). Doing the
-- whole bootstrap in one SECURITY DEFINER function avoids that and guarantees
-- the family, admin member, default permissions, rules and first season are
-- created together or not at all.
CREATE OR REPLACE FUNCTION create_family(p_family_name TEXT, p_admin_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_family_id UUID;
  v_member_id UUID;
  v_perm TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM family_members WHERE auth_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  IF coalesce(trim(p_family_name), '') = '' OR coalesce(trim(p_admin_name), '') = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  INSERT INTO families (name) VALUES (trim(p_family_name)) RETURNING id INTO v_family_id;

  INSERT INTO family_members (family_id, auth_user_id, name, role, avatar, auth_email)
    VALUES (
      v_family_id, auth.uid(), trim(p_admin_name), 'admin', '👑',
      (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    RETURNING id INTO v_member_id;

  FOREACH v_perm IN ARRAY role_default_permissions('admin') LOOP
    INSERT INTO member_permissions (member_id, permission, granted)
      VALUES (v_member_id, v_perm, true);
  END LOOP;

  INSERT INTO family_rules (family_id) VALUES (v_family_id);

  INSERT INTO seasons (family_id, name, start_date, end_date, active)
    VALUES (v_family_id, 'Saison 1', v_now, v_now + interval '2 months', true);

  RETURN v_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
