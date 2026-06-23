import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';


import type { Reward } from '../../lib/types';

export function AdminRewards() {
  const { family } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!family) return;
    loadRewards();
  }, [family]);

  async function loadRewards() {
    if (!family) return;
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false });
    setRewards(data ?? []);
  }

  async function createReward(data: { name: string; description: string; cost_in_gold: number; type: Reward['type'] }) {
    if (!family) return;
    await supabase.from('rewards').insert({ family_id: family.id, ...data });
    toast('Belohnung erstellt');
    setShowCreate(false);
    loadRewards();
  }

  async function toggleActive(rewardId: string, active: boolean) {
    await supabase.from('rewards').update({ active }).eq('id', rewardId);
    loadRewards();
  }

  async function deleteReward(rewardId: string) {
    await supabase.from('rewards').delete().eq('id', rewardId);
    toast('Belohnung gelöscht');
    loadRewards();
  }

  return (
    <div>
      <div className="admin-section-header">
        <h2>Belohnungen verwalten</h2>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Abbrechen' : 'Neue Belohnung'}
        </Button>
      </div>

      {showCreate && <RewardForm onSubmit={createReward} />}

      <div className="admin-list">
        {rewards.map((reward) => (
          <div key={reward.id} className="card card-pad-sm admin-item">
            <div className="admin-item-header">
              <div>
                <strong>{reward.name}</strong>
                <span className="muted small"> · {reward.cost_in_gold} Gold · {reward.type}</span>
              </div>
              <div className="admin-item-actions">
                <Button size="sm" variant="ghost" onClick={() => toggleActive(reward.id, !reward.active)}>
                  {reward.active ? 'Deaktivieren' : 'Aktivieren'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => deleteReward(reward.id)}>
                  Löschen
                </Button>
              </div>
            </div>
          </div>
        ))}
        {rewards.length === 0 && <p className="muted">Noch keine Belohnungen erstellt.</p>}
      </div>
    </div>
  );
}

function RewardForm({ onSubmit }: { onSubmit: (data: { name: string; description: string; cost_in_gold: number; type: Reward['type'] }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(10);
  const [type, setType] = useState<Reward['type']>('special-right');

  return (
    <form
      className="card card-pad-md admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name: name.trim(), description: description.trim(), cost_in_gold: cost, type });
      }}
    >
      <div className="form-grid-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Kosten (Gold)" type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} min={0} />
        <div className="form-field">
          <label className="form-label">Typ</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value as Reward['type'])}>
            <option value="special-right">Sonderrecht</option>
            <option value="cosmetic">Kosmetik</option>
            <option value="family-benefit">Familienvorteil</option>
            <option value="game-boost">Spielboost</option>
          </select>
        </div>
      </div>
      <Textarea label="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <Button type="submit" size="sm">Belohnung erstellen</Button>
    </form>
  );
}
