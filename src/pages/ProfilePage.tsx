import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { pinToPassword, isValidPin } from '../lib/pin';
import { isPlayingMember } from '../lib/permissions';

const AVATAR_OPTIONS = ['🦁', '🦊', '🐺', '🦉', '🐉', '🦄', '🐻', '🐨', '🦋', '🌟', '⚔️', '🛡️', '👑', '🧭', '🐯', '🦅'];

export function ProfilePage() {
  const { member, refreshMember } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(member?.name ?? '');
  const [avatar, setAvatar] = useState(member?.avatar ?? '🧭');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const [email, setEmail] = useState(member?.auth_email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  if (!member) return null;
  const isAdmin = !isPlayingMember(member.role);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!member || !name.trim()) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('family_members')
      .update({ name: name.trim(), avatar })
      .eq('id', member.id);
    if (error) toast('Speichern fehlgeschlagen.', 'error');
    else { toast('Profil gespeichert.'); await refreshMember(); }
    setSavingProfile(false);
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPin(pin)) { toast('PIN muss genau 4 Ziffern haben.', 'error'); return; }
    if (pin !== pinConfirm) { toast('PINs stimmen nicht überein.', 'error'); return; }
    setSavingPin(true);
    const { error } = await supabase.auth.updateUser({ password: pinToPassword(pin) });
    if (error) toast('PIN konnte nicht geändert werden.', 'error');
    else { toast('PIN geändert.'); setPin(''); setPinConfirm(''); }
    setSavingPin(false);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    const payload: { email?: string; password?: string } = {};
    if (email.trim() && email.trim() !== member!.auth_email) payload.email = email.trim();
    if (password) {
      if (password.length < 6) { toast('Passwort muss mindestens 6 Zeichen lang sein.', 'error'); setSavingAccount(false); return; }
      if (password !== passwordConfirm) { toast('Passwörter stimmen nicht überein.', 'error'); setSavingAccount(false); return; }
      payload.password = password;
    }
    if (!payload.email && !payload.password) { toast('Keine Änderungen.', 'error'); setSavingAccount(false); return; }

    const { error } = await supabase.auth.updateUser(payload);
    if (error) {
      toast('Kontodaten konnten nicht geändert werden.', 'error');
    } else {
      if (payload.email) {
        await supabase.from('family_members').update({ auth_email: payload.email }).eq('id', member!.id);
        await refreshMember();
      }
      toast('Kontodaten aktualisiert.');
      setPassword(''); setPasswordConfirm('');
    }
    setSavingAccount(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Profil</h1>
        <p className="muted">Verwalte deinen Namen, Avatar und deine Zugangsdaten.</p>
      </div>

      <section className="section">
        <h2>Persönliche Daten</h2>
        <form onSubmit={saveProfile} className="card card-pad-md admin-form">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="form-field">
            <label className="form-label">Avatar</label>
            <div className="avatar-grid">
              {AVATAR_OPTIONS.map((a) => (
                <button key={a} type="button" className={`avatar-option ${avatar === a ? 'selected' : ''}`} onClick={() => setAvatar(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" size="sm" loading={savingProfile}>Profil speichern</Button>
        </form>
      </section>

      {!isAdmin && (
        <section className="section">
          <h2>PIN ändern</h2>
          <form onSubmit={savePin} className="card card-pad-md admin-form">
            <div className="form-grid-2">
              <Input
                label="Neue PIN (4 Ziffern)"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                inputMode="numeric"
              />
              <Input
                label="PIN bestätigen"
                type="password"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                inputMode="numeric"
              />
            </div>
            <Button type="submit" size="sm" loading={savingPin}>PIN ändern</Button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="section">
          <h2>Kontodaten (Administrator)</h2>
          <form onSubmit={saveAccount} className="card card-pad-md admin-form">
            <Input label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="form-grid-2">
              <Input label="Neues Passwort" type="password" placeholder="Mind. 6 Zeichen" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input label="Passwort bestätigen" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
            </div>
            <p className="muted small">Leer lassen, um das Passwort nicht zu ändern.</p>
            <Button type="submit" size="sm" loading={savingAccount}>Kontodaten speichern</Button>
          </form>
        </section>
      )}
    </div>
  );
}
