import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function CreateFamilyPage() {
  const navigate = useNavigate();
  const { refreshMember } = useAuth();
  const [step, setStep] = useState<'family' | 'account'>('family');
  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (step === 'family') {
      if (!familyName.trim()) {
        setError('Bitte gib einen Familiennamen ein.');
        return;
      }
      if (!adminName.trim()) {
        setError('Bitte gib deinen Namen ein.');
        return;
      }
      setStep('account');
      return;
    }

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

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.session) {
        setError('Registrierung fehlgeschlagen. Bitte E-Mail-Bestätigung in Supabase deaktivieren.');
        setLoading(false);
        return;
      }

      // Bootstrap the whole family atomically (family + admin member + default
      // permissions + rules + first season) via a SECURITY DEFINER RPC. Doing
      // this client-side fails under RLS because INSERT ... RETURNING is checked
      // against the SELECT policy, which a not-yet-member user cannot satisfy.
      const { error: createError } = await supabase.rpc('create_family', {
        p_family_name: familyName.trim(),
        p_admin_name: adminName.trim(),
      });

      if (createError) {
        setError('Familie konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }

      // The member was created server-side after sign-up, so the auth context
      // still holds a null member. Refresh it before entering the app, otherwise
      // the protected route bounces back to the landing page.
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
        <button className="auth-back" onClick={() => step === 'family' ? navigate('/') : setStep('family')}>
          ← Zurück
        </button>

        <div className="auth-header">
          <h1>Familie erstellen</h1>
          <p className="muted">
            {step === 'family'
              ? 'Gib deiner Familie einen Namen und lege dein Admin-Konto an.'
              : 'Erstelle dein Konto mit E-Mail und Passwort.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {step === 'family' ? (
            <>
              <Input
                label="Familienname"
                placeholder="z.B. Familie Müller"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                autoFocus
              />
              <Input
                label="Dein Name"
                placeholder="z.B. Max"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
            </>
          ) : (
            <>
              <Input
                label="E-Mail"
                type="email"
                placeholder="max@example.com"
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
            {step === 'family' ? 'Weiter' : 'Familie erstellen'}
          </Button>
        </form>

        <div className="auth-steps">
          <div className={`auth-step ${step === 'family' ? 'active' : 'done'}`}>1. Familie</div>
          <div className={`auth-step ${step === 'account' ? 'active' : ''}`}>2. Konto</div>
        </div>
      </div>
    </div>
  );
}
