import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Pill } from '../../components/ui/Pill';
import { useToast } from '../../components/ui/Toast';
import { PERMISSIONS, PERMISSION_LABELS, ROLE_DEFAULTS } from '../../lib/permissions';
import type { Permission } from '../../lib/permissions';


import type { FamilyMember, MemberPermission } from '../../lib/types';

type Member = FamilyMember;

export function AdminMembers() {
  const { family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<MemberPermission[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!family) return;
    loadMembers();
  }, [family]);

  async function loadMembers() {
    if (!family) return;

    const { data: membersData } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at');

    const { data: permsData } = await supabase
      .from('member_permissions')
      .select('*')
      .in('member_id', (membersData ?? []).map((m) => m.id));

    setMembers(membersData ?? []);
    setPermissions(permsData ?? []);
  }

  async function generateInviteCode(role: 'parent' | 'player') {
    if (!family) return;

    const { data: member } = await supabase
      .from('family_members')
      .select('id')
      .eq('family_id', family.id)
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .single();

    if (!member) return;

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase.from('invite_codes').insert({
      family_id: family.id,
      code,
      role,
      created_by: member.id,
      expires_at: expiresAt.toISOString(),
    });

    setInviteCode(code);
    toast(`Einladungscode erstellt: ${code} (gültig 24h)`);
  }

  async function togglePermission(memberId: string, permission: Permission) {
    const existing = permissions.find((p) => p.member_id === memberId && p.permission === permission);

    if (existing) {
      await supabase
        .from('member_permissions')
        .update({ granted: !existing.granted })
        .eq('id', existing.id);
    } else {
      await supabase.from('member_permissions').insert({
        member_id: memberId,
        permission,
        granted: true,
      });
    }

    loadMembers();
  }

  async function updateMember(memberId: string, data: Partial<Member>) {
    await supabase.from('family_members').update(data).eq('id', memberId);
    toast('Mitglied aktualisiert');
    loadMembers();
    setEditingId(null);
  }

  const canManagePerms = hasPermission(PERMISSIONS.MANAGE_PERMISSIONS);
  const canInvite = hasPermission(PERMISSIONS.INVITE_MEMBERS);

  return (
    <div>
      <div className="admin-section-header">
        <h2>Mitglieder</h2>
        {canInvite && (
          <div className="invite-actions">
            <Button size="sm" onClick={() => generateInviteCode('player')}>
              Spieler einladen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => generateInviteCode('parent')}>
              Elternteil einladen
            </Button>
          </div>
        )}
      </div>

      {inviteCode && (
        <div className="invite-code-display">
          <strong>Einladungscode:</strong>
          <code className="code-badge">{inviteCode}</code>
          <span className="muted small">Gültig für 24 Stunden, einmal verwendbar.</span>
        </div>
      )}

      <div className="members-list">
        {members.map((m) => {
          const memberPerms = permissions.filter((p) => p.member_id === m.id);
          const isEditing = editingId === m.id;

          return (
            <div key={m.id} className="card card-pad-md member-card">
              <div className="member-header">
                <div className="member-info">
                  <span className="member-avatar">{m.avatar}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <Pill tone={m.role === 'admin' ? 'good' : m.role === 'parent' ? 'warn' : 'neutral'}>
                      {m.role === 'admin' ? 'Admin' : m.role === 'parent' ? 'Eltern' : 'Spieler'}
                    </Pill>
                  </div>
                </div>
                <div className="member-actions">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(isEditing ? null : m.id)}>
                    {isEditing ? 'Schließen' : 'Bearbeiten'}
                  </Button>
                </div>
              </div>

              {isEditing && (
                <div className="member-edit">
                  <MemberEditForm member={m} onSave={(data) => updateMember(m.id, data)} />

                  {canManagePerms && (
                    <div className="permissions-section">
                      <h4>Berechtigungen</h4>
                      <div className="permissions-grid">
                        {Object.entries(PERMISSION_LABELS).map(([perm, label]) => {
                          const granted = memberPerms.some((p) => p.permission === perm && p.granted);
                          const isDefault = (ROLE_DEFAULTS[m.role] as readonly string[]).includes(perm);
                          return (
                            <label key={perm} className="permission-toggle">
                              <input
                                type="checkbox"
                                checked={granted}
                                onChange={() => togglePermission(m.id, perm as Permission)}
                              />
                              <span className={isDefault ? '' : 'muted'}>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberEditForm({ member, onSave }: { member: Member; onSave: (data: Partial<Member>) => void }) {
  const [name, setName] = useState(member.name);
  const [avatar, setAvatar] = useState(member.avatar);
  const [role, setRole] = useState(member.role);
  const [gold, setGold] = useState(member.gold);
  const [buildingMaterial, setBuildingMaterial] = useState(member.building_material);
  const [underlings, setUnderlings] = useState(member.underlings);

  return (
    <form
      className="member-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, avatar, role, gold, building_material: buildingMaterial, underlings });
      }}
    >
      <div className="form-grid-3">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
        <div className="form-field">
          <label className="form-label">Rolle</label>
          <select className="form-input" value={role} onChange={(e) => setRole(e.target.value as Member['role'])}>
            <option value="admin">Admin</option>
            <option value="parent">Eltern</option>
            <option value="player">Spieler</option>
          </select>
        </div>
        <Input label="Gold" type="number" value={gold} onChange={(e) => setGold(Number(e.target.value))} />
        <Input label="Baumaterial" type="number" value={buildingMaterial} onChange={(e) => setBuildingMaterial(Number(e.target.value))} />
        <Input label="Untertanen" type="number" value={underlings} onChange={(e) => setUnderlings(Number(e.target.value))} />
      </div>
      <Button type="submit" size="sm">Speichern</Button>
    </form>
  );
}
