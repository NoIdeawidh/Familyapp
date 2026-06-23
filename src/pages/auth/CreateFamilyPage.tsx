import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ROLE_DEFAULTS } from '../../lib/permissions';

export function CreateFamilyPage() {
  const navigate = useNavigate();
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

      if (!authData.user) {
        setError('Registrierung fehlgeschlagen.');
        setLoading(false);
        return;
      }

      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName.trim() })
        .select()
        .single();

      if (familyError || !family) {
        setError('Familie konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }

      const { data: member, error: memberError } = await supabase
        .from('family_members')
        .insert({
          family_id: family.id,
          auth_user_id: authData.user.id,
          name: adminName.trim(),
          role: 'admin',
          avatar: '👑',
          auth_email: email,
        })
        .select()
        .single();

      if (memberError || !member) {
        setError('Admin-Konto konnte nicht erstellt werden.');
        setLoading(false);
        return;
      }

      // Set default admin permissions
      const permInserts = ROLE_DEFAULTS.admin.map((perm) => ({
        member_id: member.id,
        permission: perm,
        granted: true,
      }));

      await supabase.from('member_permissions').insert(permInserts);

      // Create default rules
      await supabase.from('family_rules').insert({ family_id: family.id });

      // Create first season
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 2);

      await supabase.from('seasons').insert({
        family_id: family.id,
        name: 'Saison 1',
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        active: true,
      });

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
