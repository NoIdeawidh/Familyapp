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
  signInWithPin: (memberId: string, pin: string) => Promise<{ error: string | null }>;
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
        loadMemberData(session.user.id).then(({ member, family, permissions }) => {
          setState({ session, user: session.user, member, family, permissions, loading: false });
        });
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

  const signInWithPin = async (memberId: string, pin: string) => {
    const { data: member } = await supabase
      .from('family_members')
      .select('auth_email')
      .eq('id', memberId)
      .single();

    const typedMember = member as { auth_email: string | null } | null;

    if (!typedMember?.auth_email) {
      return { error: 'Mitglied nicht gefunden.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: typedMember.auth_email,
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
    if (!state.user) return;
    const { member, family, permissions } = await loadMemberData(state.user.id);
    setState((prev) => ({ ...prev, member, family, permissions }));
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
