import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Family, FamilyMember, MemberPermission } from './types';
import type { Permission } from './permissions';
import { pinToPassword } from './pin';
import { rememberFamily } from './deviceFamily';

interface AuthState {
  session: Session | null;
  user: User | null;
  member: FamilyMember | null;
  family: Family | null;
  permissions: Set<Permission>;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithPin: (authEmail: string, pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (perm: Permission) => boolean;
  refreshMember: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    member: null,
    family: null,
    permissions: new Set(),
    loading: true,
  });

  const loadMemberData = useCallback(async (userId: string) => {
    const { data: member } = await supabase
      .from('family_members')
      .select('*')
      .eq('auth_user_id', userId)
      .eq('active', true)
      .single();

    if (!member) return { member: null, family: null, permissions: new Set<Permission>() };

    const typedMember = member as FamilyMember;

    const { data: family } = await supabase
      .from('families')
      .select('*')
      .eq('id', typedMember.family_id)
      .single();

    const { data: perms } = await supabase
      .from('member_permissions')
      .select('permission, granted')
      .eq('member_id', typedMember.id);

    const permissionSet = new Set<Permission>(
      ((perms ?? []) as MemberPermission[])
        .filter((p) => p.granted)
        .map((p) => p.permission as Permission)
    );

    const typedFamily = family as Family | null;
    if (typedFamily) {
      rememberFamily({ id: typedFamily.id, name: typedFamily.name });
    }

    return { member: typedMember, family: typedFamily, permissions: permissionSet };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadMemberData(session.user.id).then(({ member, family, permissions }) => {
          setState({ session, user: session.user, member, family, permissions, loading: false });
        });
      } else {
        setState((prev) => ({ ...prev, session: null, user: null, loading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Defer the member/family queries out of the callback. supabase-js holds
        // the auth lock while this callback runs, so awaiting other supabase
        // calls here deadlocks the sign-in promise (it never resolves and the UI
        // hangs on a spinner). Scheduling with setTimeout lets the lock release.
        const userId = session.user.id;
        setTimeout(() => {
          loadMemberData(userId).then(({ member, family, permissions }) => {
            setState({ session, user: session.user, member, family, permissions, loading: false });
          });
        }, 0);
      } else {
        setState({
          session: null,
          user: null,
          member: null,
          family: null,
          permissions: new Set(),
          loading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadMemberData]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithPin = async (authEmail: string, pin: string) => {
    // The synthetic login email is provided by the get_login_profiles RPC,
    // because RLS hides family_members from a not-yet-authenticated visitor.
    if (!authEmail) {
      return { error: 'Mitglied nicht gefunden.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: pinToPassword(pin),
    });

    return { error: error ? 'PIN ungültig.' : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({
      session: null,
      user: null,
      member: null,
      family: null,
      permissions: new Set(),
      loading: false,
    });
  };

  const hasPermission = (perm: Permission) => state.permissions.has(perm);

  const refreshMember = async () => {
    // Read the user from the client directly instead of from state, because the
    // caller (e.g. right after sign-up) may still hold a render in which the
    // auth state has not yet propagated the new user.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { member, family, permissions } = await loadMemberData(user.id);
    setState((prev) => ({ ...prev, session: prev.session, user, member, family, permissions, loading: false }));
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signInWithPin, signOut, hasPermission, refreshMember }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
