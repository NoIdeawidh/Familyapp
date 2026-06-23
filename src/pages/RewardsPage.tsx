import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Pill } from '../components/ui/Pill';
import { useToast } from '../components/ui/Toast';


import type { Reward, RewardRedemption } from '../lib/types';

type Redemption = RewardRedemption;

export function RewardsPage() {
  const { member, family } = useAuth();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!family) return;
    loadRewards();
  }, [family]);

  async function loadRewards() {
    if (!family || !member) return;
    setLoading(true);

    const { data: rewardsData } = await supabase
      .from('rewards')
      .select('*')
      .eq('family_id', family.id)
      .eq('active', true)
      .order('cost_in_gold');

    const { data: redemptionsData } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('member_id', member.id);

    setRewards(rewardsData ?? []);
    setRedemptions(redemptionsData ?? []);
    setLoading(false);
  }

  async function handleRedeem(rewardId: string) {
    if (!member) return;
    const reward = rewards.find((r) => r.id === rewardId);
    if (!reward || member.gold < reward.cost_in_gold) return;

    await supabase.from('reward_redemptions').insert({
      reward_id: rewardId,
      member_id: member.id,
    });

    await supabase
      .from('family_members')
      .update({ gold: member.gold - reward.cost_in_gold })
      .eq('id', member.id);

    toast('Belohnung eingelöst!');
    loadRewards();
  }

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;
  if (!member) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Belohnungsshop</h1>
        <p className="muted">Tausche Gold gegen echte Vorteile. Dein Gold: <strong>{member.gold}</strong></p>
      </div>

      <div className="rewards-grid">
        {rewards.map((reward) => {
          const redeemed = redemptions.some((r) => r.reward_id === reward.id);
          const canAfford = member.gold >= reward.cost_in_gold;

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
                <Pill tone="neutral">
                  {reward.type === 'special-right' && 'Sonderrecht'}
                  {reward.type === 'cosmetic' && 'Kosmetik'}
                  {reward.type === 'family-benefit' && 'Familienvorteil'}
                  {reward.type === 'game-boost' && 'Spielboost'}
                </Pill>
              </div>
              <Button
                size="sm"
                disabled={redeemed || !canAfford}
                onClick={() => handleRedeem(reward.id)}
              >
                {redeemed ? 'Bereits eingelöst' : 'Einlösen'}
              </Button>
            </div>
          );
        })}
        {rewards.length === 0 && <p className="muted">Noch keine Belohnungen verfügbar.</p>}
      </div>
    </div>
  );
}
