import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';
import { PERMISSIONS, isPlayingMember } from '../lib/permissions';

import type { Reward, RewardRedemption } from '../lib/types';

type Redemption = RewardRedemption;

const REWARD_TYPE_LABELS: Record<Reward['type'], string> = {
  'special-right': 'Sonderrecht',
  cosmetic: 'Kosmetik',
  'family-benefit': 'Familienvorteil',
  'game-boost': 'Spielboost',
};

export function RewardsPage() {
  const { member, family, hasPermission } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Only playing members ever see the shop; the admin is a pure manager.
  const canBuy = !!member && isPlayingMember(member.role) && hasPermission(PERMISSIONS.BUY_REWARDS);
  const canCreate = hasPermission(PERMISSIONS.CREATE_REWARDS);
  const canEdit = hasPermission(PERMISSIONS.EDIT_REWARDS);
  const canDelete = hasPermission(PERMISSIONS.DELETE_REWARDS);
  const canManage = canCreate || canEdit || canDelete;

  useEffect(() => {
    if (!family) return;
    loadRewards();
  }, [family]);

  async function loadRewards() {
    if (!family) return;
    setLoading(true);

    const { data: rewardsData } = await supabase
      .from('rewards')
      .select('*')
      .eq('family_id', family.id)
      .order('cost_in_gold');

    const { data: redemptionsData } = member
      ? await supabase.from('reward_redemptions').select('*').eq('member_id', member.id)
      : { data: [] };

    setRewards(rewardsData ?? []);
    setRedemptions(redemptionsData ?? []);
    setLoading(false);
  }

  async function handleRedeem(rewardId: string) {
    if (!member) return;
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || member.gold < reward.cost_in_gold) return;

    await supabase.from('reward_redemptions').insert({ reward_id: rewardId, member_id: member.id });
    await supabase
      .from('family_members')
      .update({ gold: member.gold - reward.cost_in_gold })
      .eq('id', member.id);

    toast('Belohnung eingelöst!');
    loadRewards();
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

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;

  const shopRewards = rewards.filter((r) => r.active);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Belohnungen</h1>
        <p className="muted">
          {canBuy && member
            ? <>Tausche Gold gegen echte Vorteile. Dein Gold: <strong>{member.gold}</strong></>
            : 'Verwalte die Belohnungen, die deine Familie im Shop eintauschen kann.'}
        </p>
      </div>

      {canBuy && (
        <section className="section">
          <h2>Shop</h2>
          <div className="rewards-grid">
            {shopRewards.map((reward) => {
              const redeemed = redemptions.some((r) => r.reward_id === reward.id);
              const canAfford = !!member && member.gold >= reward.cost_in_gold;

              return (
                <div key={reward.id} className="card card-pad-md reward-card">
                  <div className="reward-header">
                    <h3>{reward.name}</h3>
                    <Pill tone={redeemed ? 'good' : canAfford ? 'neutral' : 'danger'}>
                      {redeemed ? 'Eingelöst' : `${reward.cost_in_gold} Gold`}
                    </Pill>
                  </div>
                  <p className="muted small">{reward.description}</p>
                  <div className="reward-type">
                    <Pill tone="neutral">{REWARD_TYPE_LABELS[reward.type]}</Pill>
                  </div>
                  <Button size="sm" disabled={redeemed || !canAfford} onClick={() => handleRedeem(reward.id)}>
                    {redeemed ? 'Bereits eingelöst' : 'Einlösen'}
                  </Button>
                </div>
              );
            })}
            {shopRewards.length === 0 && <p className="muted">Noch keine Belohnungen verfügbar.</p>}
          </div>
        </section>
      )}

      {canManage && (
        <section className="section">
          <div className="admin-section-header">
            <h2>Verwaltung</h2>
            {canCreate && (
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? 'Abbrechen' : 'Neue Belohnung'}
              </Button>
            )}
          </div>

          {showCreate && canCreate && <RewardForm onSubmit={createReward} />}

          <div className="admin-list">
            {rewards.map((reward) => (
              <div key={reward.id} className="card card-pad-sm admin-item">
                <div className="admin-item-header">
                  <div>
                    <strong>{reward.name}</strong>
                    <span className="muted small"> · {reward.cost_in_gold} Gold · {REWARD_TYPE_LABELS[reward.type]}</span>
                  </div>
                  <div className="admin-item-actions">
                    {!reward.active && <span className="badge badge-warn">inaktiv</span>}
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(reward.id, !reward.active)}>
                        {reward.active ? 'Deaktivieren' : 'Aktivieren'}
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="danger" onClick={() => deleteReward(reward.id)}>
                        Löschen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {rewards.length === 0 && <p className="muted">Noch keine Belohnungen erstellt.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function RewardForm({ onSubmit }: { onSubmit: (data: { name: string; description: string; cost_in_gold: number; type: Reward['type'] }) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(10);
  const [type, setType] = useState<Reward['type']>('family-benefit');

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
            <option value="family-benefit">Familienvorteil</option>
            <option value="special-right">Sonderrecht</option>
            <option value="game-boost">Spielboost</option>
            <option value="cosmetic">Kosmetik</option>
          </select>
        </div>
      </div>
      <Textarea label="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <Button type="submit" size="sm">Belohnung erstellen</Button>
    </form>
  );
}
