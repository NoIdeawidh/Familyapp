import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { getRememberedFamily, forgetFamily } from '../../lib/deviceFamily';
import { isValidPin } from '../../lib/pin';

type LoginMode = 'email' | 'pin';

interface LoginProfile {
  id: string;
  name: string;
  avatar: string;
  role: string;
  uses_pin: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithPin } = useAuth();
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberedFamily] = useState(getRememberedFamily());
  const [profiles, setProfiles] = useState<LoginProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<LoginProfile | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (mode === 'pin' && rememberedFamily) {
      supabase
        .rpc('get_login_profiles', { p_family_id: rememberedFamily.id })
        .then(({ data }) => {
          setProfiles((data as LoginProfile[] | null) ?? []);
        });
    }
  }, [mode, rememberedFamily]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Bitte fülle alle Felder aus.');
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError('E-Mail oder Passwort ungültig.');
      return;
    }
    navigate('/app');
  }

  async function handlePinLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedProfile) return;
    if (!isValidPin(pin)) {
      setError('PIN muss 4 Ziffern haben.');
      return;
    }
    setLoading(true);
    const { error: err } = await signInWithPin(selectedProfile.id, pin);
    setLoading(false);
    if (err) {
      setError('PIN ungültig.');
      return;
    }
    navigate('/app');
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <button className="auth-back" onClick={() => navigate('/')}>
          ← Zurück
        </button>

        <div className="auth-header">
          <h1>Anmelden</h1>
          <p className="muted">Melde dich mit deinem Konto an.</p>
        </div>

        <div className="auth-mode-toggle">
          <button className={`mode-btn ${mode === 'email' ? 'active' : ''}`} onClick={() => setMode('email')}>
            E-Mail & Passwort
          </button>
          <button className={`mode-btn ${mode === 'pin' ? 'active' : ''}`} onClick={() => setMode('pin')}>
            Spieler-PIN
          </button>
        </div>

        {mode === 'email' ? (
          <form onSubmit={handleEmailLogin} className="auth-form">
            <Input label="E-Mail" type="email" placeholder="max@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <Input label="Passwort" type="password" placeholder="Dein Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" fullWidth size="lg" loading={loading}>Anmelden</Button>
          </form>
        ) : !rememberedFamily ? (
          <div className="auth-form">
            <p className="muted">
              Auf diesem Gerät ist noch keine Familie hinterlegt. Bitte zuerst per E-Mail anmelden oder einer Familie beitreten.
            </p>
            <Button variant="secondary" fullWidth onClick={() => navigate('/auth/join-family')}>
              Familie beitreten
            </Button>
          </div>
        ) : !selectedProfile ? (
          <div className="auth-form">
            <p className="muted small">Familie: <strong>{rememberedFamily.name}</strong> · <button className="link-btn" onClick={() => { forgetFamily(); navigate(0); }}>wechseln</button></p>
            <div className="profile-picker">
              {profiles.filter((p) => p.uses_pin).map((profile) => (
                <button key={profile.id} className="profile-card" onClick={() => setSelectedProfile(profile)}>
                  <span className="profile-avatar">{profile.avatar}</span>
                  <span className="profile-name">{profile.name}</span>
                </button>
              ))}
              {profiles.filter((p) => p.uses_pin).length === 0 && (
                <p className="muted">Keine Spieler-Profile in dieser Familie.</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handlePinLogin} className="auth-form">
            <div className="selected-profile">
              <span className="profile-avatar">{selectedProfile.avatar}</span>
              <strong>{selectedProfile.name}</strong>
              <button type="button" className="link-btn" onClick={() => { setSelectedProfile(null); setPin(''); setError(''); }}>
                ändern
              </button>
            </div>
            <Input
              label="PIN (4 Ziffern)"
              type="password"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              inputMode="numeric"
              autoFocus
            />
            {error && <div className="auth-error">{error}</div>}
            <Button type="submit" fullWidth size="lg" loading={loading}>Anmelden</Button>
          </form>
        )}

        <div className="auth-footer">
          <p className="muted small">
            Noch kein Konto?{' '}
            <button className="link-btn" onClick={() => navigate('/auth/create-family')}>Familie erstellen</button>
            {' '}oder{' '}
            <button className="link-btn" onClick={() => navigate('/auth/join-family')}>beitreten</button>
          </p>
        </div>
      </div>
    </div>
  );
}
