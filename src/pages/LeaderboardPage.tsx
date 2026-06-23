import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';


import type { FamilyMember } from '../lib/types';

type Member = FamilyMember;

export function LeaderboardPage() {
  const { member, family } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!family) return;

    async function load() {
      const { data } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', family!.id)
        .eq('active', true)
        .order('season_victory_points', { ascending: false });

      setMembers(data ?? []);
      setLoading(false);
    }

    load();
  }, [family]);

  if (loading) return <div className="page"><p className="muted">Lädt...</p></div>;
  if (!member) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Rangliste</h1>
        <p className="muted">Wer hat die meisten Siegpunkte in dieser Saison?</p>
      </div>

      <div className="leaderboard-columns">
        <section className="section">
          <h2>Saison-Rangliste</h2>
          <div className="leaderboard-list">
            {members.map((m, index) => (
              <div
                key={m.id}
                className={`card card-pad-md leaderboard-row ${m.id === member.id ? 'highlight' : ''}`}
              >
                <div className="leader-rank">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                <div className="leader-info">
                  <span className="leader-avatar">{m.avatar}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <div className="muted small">{m.role === 'admin' ? 'Admin' : m.role === 'parent' ? 'Eltern' : 'Spieler'}</div>
                  </div>
                </div>
                <div className="leader-stats">
                  <div><strong>{m.season_victory_points}</strong> <span className="muted small">SP</span></div>
                  <div className="muted small">{m.total_victory_points} gesamt</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Ressourcen-Vergleich</h2>
          <div className="leaderboard-list">
            {members.map((m) => (
              <div key={m.id} className={`card card-pad-sm resource-compare ${m.id === member.id ? 'highlight' : ''}`}>
                <span>{m.avatar} {m.name}</span>
                <div className="resource-badges">
                  <span className="badge">💰 {m.gold}</span>
                  <span className="badge">👥 {m.underlings}</span>
                  <span className="badge">🧱 {m.building_material}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
