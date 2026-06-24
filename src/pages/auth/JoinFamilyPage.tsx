import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { pinToPassword, isValidPin } from '../../lib/pin';
import { rememberFamily } from '../../lib/deviceFamily';

const AVATAR_OPTIONS = ['🦁', '🦊', '🐺', '🦉', '🐉', '🦄', '🐻', '🐨', '🦋', '🌟', '⚔️', '🛡️'];

type Step = 'code' | 'profile' | 'credentials';

interface InviteData {
  id: string;
  family_id: string;
  role: 'admin' | 'parent' | 'player';
  familyName?: string;
}

export function JoinFamilyPage() {
  const navigate = useNavigate();
  const { refreshMember } = useAuth();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦁');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  const usesPin = inviteData?.role === 'player';

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      setError('Bitte gib einen gültigen Einladungscode ein.');
      setLoading(false);
      return;
    }

    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, family_id, role')
      .eq('code', normalizedCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      setError('Code ungültig oder abgelaufen.');
      setLoading(false);
      return;
    }

    const typed = invite as { id: string; family_id: string; role: 'admin' | 'parent' | 'player' };

    // Family name is fetched via a SECURITY DEFINER RPC because RLS hides the
    // families table from anonymous (not-yet-joined) users.
    const { data: summary } = await supabase.rpc('get_family_summary', {
      p_family_id: typed.family_id,
    });
    const familyName = (summary as { id: string; name: string }[] | null)?.[0]?.name;

    setInviteData({
      id: typed.id,
      family_id: typed.family_id,
      role: typed.role,
      familyName,
    });
    if (familyName) {
      rememberFamily({ id: typed.family_id, name: familyName });
    }
    setStep('profile');
    setLoading(false);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Bitte gib deinen Namen ein.');
      return;
    }
    setStep('credentials');
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!inviteData) return;

    let authEmail: string;
    let authPassword: string;

    if (usesPin) {
      if (!isValidPin(pin)) {
        setError('PIN muss genau 4 Ziffern haben.');
        return;
      }
      if (pin !== pinConfirm) {
        setError('PINs stimmen nicht überein.');
        return;
      }
      authEmail = `player_${crypto.randomUUID().slice(0, 12)}@familienreich.internal`;
      authPassword = pinToPassword(pin);
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Bitte fülle alle Felder aus.');
        return;
      }
      if (password.length < 6) {
        setError('Passwort muss mindestens 6 Zeichen lang sein.');
        return;
      }
      if (password !== passwordConfirm) {
        setError('Passwörter stimmen nicht überein.');
        return;
      }
      authEmail = email.trim();
      authPassword = password;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (authError || !authData.user) {
        setError(authError?.message ?? 'Konto konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }

      // The member, default permissions and code invalidation are created
      // atomically server-side, so an invite can never be bypassed or reused.
      const { error: redeemError } = await supabase.rpc('redeem_invite', {
        p_code: code.trim().toUpperCase(),
        p_name: name.trim(),
        p_avatar: avatar,
      });

      if (redeemError) {
        setError('Beitritt fehlgeschlagen. Der Code ist eventuell abgelaufen.');
        setLoading(false);
        return;
      }

      // The member is created server-side by redeem_invite, so refresh the auth
      // context before navigating, otherwise the protected route bounces back.
      await refreshMember();
      navigate('/app');
    } catch {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <button
          className="auth-back"
          onClick={() => {
            if (step === 'code') navigate('/');
            else if (step === 'profile') setStep('code');
            else setStep('profile');
          }}
        >
          ← Zurück
        </button>

        <div className="auth-header">
          <h1>Familie beitreten</h1>
          <p className="muted">
            {step === 'code' && 'Gib den Einladungscode ein, den du erhalten hast.'}
            {step === 'profile' && `Du trittst "${inviteData?.familyName ?? 'Familie'}" bei. Wähle Namen und Avatar.`}
            {step === 'credentials' && usesPin && 'Lege eine 4-stellige PIN fest, mit der du dich anmeldest.'}
            {step === 'credentials' && !usesPin && 'Erstelle dein Konto mit E-Mail und Passwort.'}
          </p>
        </div>

        {step === 'code' && (
          <form onSubmit={handleCodeSubmit} className="auth-form">
            <Input
              label="Einladungscode"
              placeholder="z.B. ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              className="code-input"
            />
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Code prüfen
            </Button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="auth-form">
            <Input
              label="Dein Name"
              placeholder="z.B. Lena"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="form-field">
              <label className="form-label">Avatar wählen</label>
              <div className="avatar-grid">
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`avatar-option ${avatar === a ? 'selected' : ''}`}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" fullWidth size="lg">
              Weiter
            </Button>
          </form>
        )}

        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="auth-form">
            {usesPin ? (
              <>
                <Input
                  label="PIN festlegen (4 Ziffern)"
                  type="password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                  autoFocus
                />
                <Input
                  label="PIN bestätigen"
                  type="password"
                  placeholder="••••"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                />
              </>
            ) : (
              <>
                <Input
                  label="E-Mail"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
                <Input
                  label="Passwort"
                  type="password"
                  placeholder="Mindestens 6 Zeichen"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  label="Passwort bestätigen"
                  type="password"
                  placeholder="Passwort wiederholen"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </>
            )}
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Beitreten
            </Button>
          </form>
        )}

        <div className="auth-steps">
          <div className={`auth-step ${step === 'code' ? 'active' : 'done'}`}>1. Code</div>
          <div className={`auth-step ${step === 'profile' ? 'active' : step === 'credentials' ? 'done' : ''}`}>2. Profil</div>
          <div className={`auth-step ${step === 'credentials' ? 'active' : ''}`}>3. {usesPin ? 'PIN' : 'Konto'}</div>
        </div>
      </div>
    </div>
  );
}
