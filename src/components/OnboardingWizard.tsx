import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { TASK_TEMPLATES, REWARD_TEMPLATES } from '../lib/onboardingTemplates';

type Step = 'welcome' | 'tasks' | 'rewards' | 'done';

export function OnboardingWizard() {
  const { family, member, refreshMember } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const [taskSel, setTaskSel] = useState<boolean[]>(TASK_TEMPLATES.map(() => true));
  const [rewardSel, setRewardSel] = useState<boolean[]>(REWARD_TEMPLATES.map(() => true));
  const [saving, setSaving] = useState(false);

  if (!family || !member) return null;

  const toggle = (arr: boolean[], set: (v: boolean[]) => void, i: number) =>
    set(arr.map((v, idx) => (idx === i ? !v : v)));

  async function finish(withTemplates: boolean) {
    if (!family || !member) return;
    setSaving(true);
    try {
      if (withTemplates) {
        const taskRows = TASK_TEMPLATES.filter((_, i) => taskSel[i]).map((t) => ({
          family_id: family.id,
          created_by: member.id,
          title: t.title,
          description: t.description,
          category: t.category,
          type: 'open' as const,
          assigned_to: null,
          value_in_underlings: t.value_in_underlings,
          needs_approval: true,
          recurrence: 'daily' as const,
          recurrence_interval_days: null,
          due_date: null,
          repeatable: true,
          status: 'open' as const,
        }));
        const rewardRows = REWARD_TEMPLATES.filter((_, i) => rewardSel[i]).map((r) => ({
          family_id: family.id,
          name: r.name,
          description: r.description,
          cost_in_gold: r.cost_in_gold,
          type: r.type,
          active: true,
        }));
        if (taskRows.length) await supabase.from('tasks').insert(taskRows);
        if (rewardRows.length) await supabase.from('rewards').insert(rewardRows);
      }
      await supabase.from('families').update({ onboarded: true }).eq('id', family.id);
      await refreshMember();
      toast(withTemplates ? 'Einrichtung abgeschlossen!' : 'Assistent übersprungen.');
    } catch {
      toast('Speichern fehlgeschlagen.', 'error');
    }
    setSaving(false);
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard card card-pad-lg">
        {step === 'welcome' && (
          <>
            <h2>Willkommen bei Familien-Reich! 👑</h2>
            <p className="muted">
              Verwandle Haushaltsaufgaben in ein Strategiespiel. So funktioniert's:
            </p>
            <ul className="wizard-list">
              <li><strong>Aufgaben</strong> erledigen → <strong>Untertanen</strong> verdienen.</li>
              <li>Mit Untertanen auf der <strong>Reichskarte</strong> Felder erobern.</li>
              <li>Jedes Feld bringt <strong>Siegpunkte</strong> für die Rangliste.</li>
              <li>Gold aus Feldern gegen <strong>Belohnungen</strong> eintauschen.</li>
              <li>Jede <strong>Saison</strong> beginnt der Wettkampf neu.</li>
            </ul>
            <p className="muted small">
              Wir schlagen dir ein paar Standard-Aufgaben und -Belohnungen vor. Du kannst alles später anpassen.
            </p>
            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => finish(false)} disabled={saving}>Überspringen</Button>
              <Button onClick={() => setStep('tasks')}>Los geht's</Button>
            </div>
          </>
        )}

        {step === 'tasks' && (
          <>
            <h2>Standard-Aufgaben wählen</h2>
            <p className="muted small">Ausgewählte Aufgaben werden als tägliche Aufgaben angelegt (mit Bestätigung).</p>
            <div className="wizard-picks">
              {TASK_TEMPLATES.map((t, i) => (
                <label key={t.title} className={`wizard-pick ${taskSel[i] ? 'selected' : ''}`}>
                  <input type="checkbox" checked={taskSel[i]} onChange={() => toggle(taskSel, setTaskSel, i)} />
                  <span className="wizard-pick-main">
                    <strong>{t.title}</strong>
                    <span className="muted small">{t.description}</span>
                  </span>
                  <span className="wizard-pick-value">+{t.value_in_underlings}</span>
                </label>
              ))}
            </div>
            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => setStep('welcome')}>Zurück</Button>
              <Button onClick={() => setStep('rewards')}>Weiter</Button>
            </div>
          </>
        )}

        {step === 'rewards' && (
          <>
            <h2>Standard-Belohnungen wählen</h2>
            <p className="muted small">Belohnungen können Spieler später mit Gold im Shop eintauschen.</p>
            <div className="wizard-picks">
              {REWARD_TEMPLATES.map((r, i) => (
                <label key={r.name} className={`wizard-pick ${rewardSel[i] ? 'selected' : ''}`}>
                  <input type="checkbox" checked={rewardSel[i]} onChange={() => toggle(rewardSel, setRewardSel, i)} />
                  <span className="wizard-pick-main">
                    <strong>{r.name}</strong>
                    <span className="muted small">{r.description}</span>
                  </span>
                  <span className="wizard-pick-value">{r.cost_in_gold} Gold</span>
                </label>
              ))}
            </div>
            <div className="wizard-actions">
              <Button variant="ghost" onClick={() => setStep('tasks')}>Zurück</Button>
              <Button onClick={() => finish(true)} loading={saving}>Einrichtung abschließen</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
